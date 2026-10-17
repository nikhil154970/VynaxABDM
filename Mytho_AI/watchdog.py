"""
Mytho_AI Server Watchdog
Automatically restarts the server if it crashes or stops responding.
Run this instead of server.py to keep the assistant always online.
"""

import subprocess
import time
import requests
import sys
import os

SERVER_PATH = os.path.join(os.path.dirname(__file__), "server.py")
PYTHON_PATH = os.path.join(os.path.dirname(__file__), "venv", "Scripts", "python.exe")
HEALTH_URL = "http://localhost:5001/health"
CHECK_INTERVAL = 10  # seconds between health checks
RESTART_DELAY = 3    # seconds to wait before restart

def is_server_running():
    try:
        resp = requests.get(HEALTH_URL, timeout=5)
        return resp.status_code == 200
    except Exception:
        return False

def start_server():
    proc = subprocess.Popen(
        [PYTHON_PATH, SERVER_PATH],
        cwd=os.path.dirname(__file__),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"[watchdog] Server started (PID: {proc.pid})")
    return proc

def main():
    print("=" * 50)
    print("  Mytho_AI Watchdog — Auto-restart enabled")
    print("  Press Ctrl+C to stop")
    print("=" * 50)

    proc = start_server()

    try:
        while True:
            time.sleep(CHECK_INTERVAL)

            if not is_server_running():
                print(f"[watchdog] Server is DOWN — restarting...")

                # Kill old process if still alive
                try:
                    proc.kill()
                except Exception:
                    pass

                time.sleep(RESTART_DELAY)
                proc = start_server()
                print(f"[watchdog] Server restarted successfully")

    except KeyboardInterrupt:
        print("\n[watchdog] Stopping watchdog and server...")
        try:
            proc.kill()
        except Exception:
            pass
        sys.exit(0)

if __name__ == "__main__":
    main()
