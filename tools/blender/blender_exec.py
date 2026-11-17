"""Send a Python file to the Blender MCP add-on socket (default 127.0.0.1:9876) and print the result.

Usage: python tools/blender/blender_exec.py script.py [--set KEY=VALUE ...]
Each --set is injected as a global string variable before the script runs.
"""
import json
import socket
import sys


def run(code, host="127.0.0.1", port=9876, timeout=900):
    with socket.create_connection((host, port), timeout=timeout) as s:
        s.sendall(json.dumps({"type": "execute_code", "params": {"code": code}}).encode())
        buf = b""
        while True:
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
            try:
                return json.loads(buf)
            except json.JSONDecodeError:
                continue
    return json.loads(buf)


if __name__ == "__main__":
    path, *rest = sys.argv[1:]
    prelude = ""
    for i, a in enumerate(rest):
        if a == "--set":
            k, v = rest[i + 1].split("=", 1)
            prelude += f"{k} = {v!r}\n"
    resp = run(prelude + open(path, encoding="utf-8").read())
    if resp.get("status") != "success":
        print(json.dumps(resp, indent=2))
        sys.exit(1)
    print(resp["result"].get("result", resp["result"]))
