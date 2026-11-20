"""Bounded nginx checks in disposable, network-isolated containers.

Usage: python3 scripts/check-nginx.py sha256:<image> deploy/nginx.conf /absolute/qa-dir
The QA directory retains the two inspected configurations. No public traffic is sent.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time


def command(args, check=True):
    return subprocess.run(args, text=True, capture_output=True, timeout=30, check=check)


def inspect(image, config, rate_probe=False):
    result = command([
        "docker", "run", "--rm", "-d", "--network", "none", "--read-only",
        "--user", "101:101", "--tmpfs", "/tmp:size=16m,mode=1777,noexec,nosuid",
        "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
        "--memory", "64m", "--pids-limit", "32", "--cpus", "0.5",
        "--mount", f"type=bind,src={config},dst=/etc/nginx/nginx.conf,readonly", image,
    ])
    container = result.stdout.strip()
    if not re.fullmatch(r"[a-f0-9]{64}", container):
        raise RuntimeError("Unexpected container ID")
    try:
        def request(path="/", extra=()):
            response = command(["docker", "exec", container, "wget", "-S", "-O", "/dev/null", *extra,
                                "http://127.0.0.1:8080" + path], check=False)
            text = response.stdout + response.stderr
            matches = re.findall(r"HTTP/\S+ (\d{3})", text)
            return int(matches[-1]) if matches else None, text

        for _ in range(10):
            if request("/healthz")[0] == 200:
                break
            time.sleep(0.2)
        else:
            raise AssertionError("Isolated nginx did not become healthy")
        command(["docker", "exec", container, "nginx", "-t"])
        if rate_probe:
            statuses = [request(extra=("--header", f"X-Forwarded-For: 192.0.2.{n + 1}"))[0] for n in range(10)]
            assert 200 in statuses and 429 in statuses, statuses
            assert request("/healthz")[0] == 200
            return {"rate_probe": statuses, "health_exempt": True, "spoofed_ip_does_not_split_budget": True}
        status, headers = request()
        assert status == 200, status
        lower = headers.lower()
        for header in ["x-content-type-options: nosniff", "x-frame-options: deny",
                       "content-security-policy:", "object-src 'none'", "form-action 'self'",
                       "permissions-policy:", "cache-control: no-cache"]:
            assert header in lower, header
        for path, options, expected in [("/missing-qa-page", (), 404), ("/.git/config", (), 404),
                                         ("/", ("--post-data", "qa=1"), 405)]:
            actual = request(path, options)[0]
            assert actual == expected, (path, actual, expected)
        return {"index": 200, "missing": 404, "dotpath": 404, "post": 405, "headers": True, "nginx_config": True}
    finally:
        command(["docker", "stop", "--time", "3", container], check=False)


def main():
    if len(sys.argv) != 4 or not re.fullmatch(r"sha256:[a-f0-9]{64}", sys.argv[1]):
        raise SystemExit(__doc__)
    image, source, output = sys.argv[1], Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve()
    config = source.read_text(encoding="utf-8")
    assert "zone=atlas_origin:1m rate=300r/s;" in config
    assert "server_name maple.omerlabinsky.com;" in config
    assert "limit_req zone=atlas_origin burst=600 nodelay;" in config
    output.mkdir(parents=True, exist_ok=True)
    production = output / "production-nginx.conf"
    limited = output / "rate-probe-nginx.conf"
    production.write_text(config, encoding="utf-8")
    # Exercise the same limiter with a deliberately small isolated budget.
    limited.write_text(config.replace("rate=300r/s;", "rate=1r/m;").replace("burst=600", "burst=1"), encoding="utf-8")
    report = {"image": image, "production_config": inspect(image, production),
              "isolated_limiter": inspect(image, limited, rate_probe=True)}
    (output / "result.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
