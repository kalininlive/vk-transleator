from flask import Flask, request, jsonify
import requests
import os
import json
import logging
import subprocess
import signal
import time
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SERVER_HOST = os.getenv("SERVER_HOST", "obs.kalininlive.ru")
OVERLAY_URL = os.getenv("OVERLAY_URL") or f"https://{SERVER_HOST}/overlay"

API_SECRET = os.getenv("API_SECRET", "change_me_stream_secret")

XVFB_PID = "/tmp/vk_xvfb.pid"
OBS_PID  = "/tmp/vk_obs.pid"
OBS_HOME = "/root/.config/obs-studio"

DISPLAY_NUM = ":99"
RESOLUTION  = "1920x1080"


def _supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def get_active_channel():
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/vk_channels",
            headers=_supabase_headers(),
            params={"is_active": "eq.true", "select": "rtmp_url,stream_key", "limit": "1"},
            timeout=10
        )
        resp.raise_for_status()
        rows = resp.json()
        if rows:
            return {"rtmp_url": rows[0]["rtmp_url"], "stream_key": rows[0]["stream_key"]}
    except Exception as e:
        logger.error(f"Supabase Error: {e}")
    return None


def _get_match_state():
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/football_match_state",
        headers=_supabase_headers(),
        params={"id": "eq.1", "select": "state", "limit": "1"},
        timeout=10
    )
    resp.raise_for_status()
    rows = resp.json()
    return rows[0]["state"] if rows else {}


def _patch_match_state(state):
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/football_match_state",
        headers=_supabase_headers(),
        params={"id": "eq.1"},
        json={"state": state, "updated_at": datetime.now(timezone.utc).isoformat()},
        timeout=10
    )
    resp.raise_for_status()
    return resp.json()


def check_auth():
    if request.headers.get('x-secret') != API_SECRET:
        return jsonify({"status": "error", "message": "Wrong API Secret"}), 403


def _read_pid(path):
    try:
        with open(path) as f:
            return int(f.read().strip())
    except Exception:
        return None


def _process_alive(pid):
    if pid is None:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def is_streaming():
    return _process_alive(_read_pid(OBS_PID))


def _kill_pid_file(path, name="process"):
    pid = _read_pid(path)
    if pid and _process_alive(pid):
        try:
            os.kill(pid, signal.SIGTERM)
            logger.info(f"Killed {name} pid={pid}")
        except Exception as e:
            logger.warning(f"Kill {name} error: {e}")
    try:
        os.remove(path)
    except Exception:
        pass


def kill_all():
    _kill_pid_file(OBS_PID, "obs")
    time.sleep(2)
    _kill_pid_file(XVFB_PID, "Xvfb")


def setup_obs_config(rtmp_server, stream_key):
    scenes_dir = f"{OBS_HOME}/basic/scenes"
    profile_dir = f"{OBS_HOME}/basic/profiles/vk-stream"
    os.makedirs(scenes_dir, exist_ok=True)
    os.makedirs(profile_dir, exist_ok=True)

    scene_data = {
        "current_program_scene": "Main",
        "current_scene": "Main",
        "current_transition": "Cut",
        "groups": [],
        "modules": {},
        "name": "vk-stream",
        "preview_locked": False,
        "quick_transitions": [],
        "saved_projectors": [],
        "scaling_enabled": False,
        "scene_order": [{"name": "Main"}],
        "sources": [
            {
                "enabled": True, "flags": 0, "hotkeys": {},
                "id": "ffmpeg_source",
                "mixers": 255, "monitoring_type": 0, "muted": False,
                "name": "Camera", "private_settings": {},
                "settings": {
                    "buffering_mb": 2,
                    "clear_on_media_end": False,
                    "hw_decode": False,
                    "input": "rtmp://localhost/live/stream",
                    "is_local_file": False,
                    "restart_on_activate": True
                },
                "sync": 0, "versioned_id": "ffmpeg_source", "volume": 1.0
            },
            {
                "enabled": True, "flags": 0, "hotkeys": {},
                "id": "browser_source",
                "mixers": 255, "monitoring_type": 0, "muted": False,
                "name": "Overlay", "private_settings": {},
                "settings": {
                    "css": "body { background: transparent !important; margin: 0; padding: 0; }",
                    "fps": 30,
                    "fps_custom": False,
                    "height": 1080,
                    "is_local_file": False,
                    "local_file": "",
                    "restart_when_active": False,
                    "reroute_audio": False,
                    "shutdown": False,
                    "url": OVERLAY_URL,
                    "width": 1920
                },
                "sync": 0, "versioned_id": "browser_source", "volume": 1.0
            },
            {
                "enabled": True, "flags": 0, "hotkeys": {},
                "id": "scene", "mixers": 0, "monitoring_type": 0, "muted": False,
                "name": "Main", "private_settings": {},
                "settings": {
                    "id_counter": 2,
                    "items": [
                        {
                            "align": 5, "bounds": {"x": 0.0, "y": 0.0},
                            "bounds_align": 0, "bounds_type": 0,
                            "crop_bottom": 0, "crop_left": 0, "crop_right": 0, "crop_top": 0,
                            "group_item_backup": False, "id": 1, "locked": False,
                            "name": "Camera",
                            "pos": {"x": 0.0, "y": 0.0}, "private_settings": {},
                            "rot": 0.0, "scale": {"x": 1.0, "y": 1.0},
                            "scale_filter": 0, "show_in_multiview": True, "visible": True
                        },
                        {
                            "align": 5, "bounds": {"x": 0.0, "y": 0.0},
                            "bounds_align": 0, "bounds_type": 0,
                            "crop_bottom": 0, "crop_left": 0, "crop_right": 0, "crop_top": 0,
                            "group_item_backup": False, "id": 2, "locked": False,
                            "name": "Overlay",
                            "pos": {"x": 0.0, "y": 0.0}, "private_settings": {},
                            "rot": 0.0, "scale": {"x": 1.0, "y": 1.0},
                            "scale_filter": 0, "show_in_multiview": True, "visible": True
                        }
                    ]
                },
                "sync": 0, "versioned_id": "scene", "volume": 0.0
            }
        ],
        "transition_duration": 300,
        "transitions": []
    }
    with open(f"{scenes_dir}/vk-stream.json", 'w') as f:
        json.dump(scene_data, f, indent=2)

    with open(f"{profile_dir}/basic.ini", 'w') as f:
        f.write(
            "[General]\nName=vk-stream\n\n"
            "[Video]\n"
            "BaseCX=1920\nBaseCY=1080\n"
            "OutputCX=1920\nOutputCY=1080\n"
            "FPSCommon=30\nFPSType=0\n"
            "ColorFormat=NV12\nColorSpace=709\nColorRange=Partial\n\n"
            "[Audio]\nSampleRate=44100\nChannels=2\n\n"
            "[Output]\nMode=Simple\n\n"
            "[SimpleOutput]\nStreamEncoder=x264\nVBitrate=3000\nABitrate=128\n"
        )

    with open(f"{profile_dir}/service.json", 'w') as f:
        json.dump({"settings": {"key": stream_key, "server": rtmp_server}, "type": "rtmp_custom"}, f)

    with open(f"{profile_dir}/streamEncoder.json", 'w') as f:
        json.dump({
            "bitrate": 3000, "keyint_sec": 2,
            "preset": "ultrafast", "profile": "main",
            "rate_control": "CBR", "tune": "zerolatency"
        }, f)

    with open(f"{OBS_HOME}/global.ini", 'w') as f:
        f.write("[Basic]\nSceneCollection=vk-stream\nProfile=vk-stream\n")

    logger.info(f"OBS config: server={rtmp_server} key=***")


@app.route('/status', methods=['GET'])
def stream_status():
    auth_err = check_auth()
    if auth_err:
        return auth_err
    return jsonify({"status": "ok", "streaming": is_streaming()})


@app.route('/start', methods=['GET', 'POST'])
def start_stream():
    auth_err = check_auth()
    if auth_err:
        return auth_err

    if is_streaming():
        return jsonify({"status": "ok", "message": "Already streaming"})

    channel = get_active_channel()
    if not channel:
        return jsonify({"status": "error", "message": "Нет активного VK-канала"}), 400

    rtmp_target = f"{channel['rtmp_url'].rstrip('/')}/{channel['stream_key']}"
    last_slash = rtmp_target.rfind('/')
    rtmp_server = rtmp_target[:last_slash]
    stream_key  = rtmp_target[last_slash + 1:]

    try:
        setup_obs_config(rtmp_server, stream_key)

        global_ini = f"{OBS_HOME}/global.ini"
        if os.path.exists(global_ini):
            with open(global_ini, 'r') as f:
                ini = f.read()
            ini = ini.replace('UncleanShutdown=true', 'UncleanShutdown=false')
            with open(global_ini, 'w') as f:
                f.write(ini)

        xvfb = subprocess.Popen(
            ['Xvfb', DISPLAY_NUM, '-screen', '0', f'{RESOLUTION}x24', '-nocursor'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        with open(XVFB_PID, 'w') as f:
            f.write(str(xvfb.pid))
        logger.info(f"Xvfb started pid={xvfb.pid}")
        time.sleep(2)

        obs_env = {
            **os.environ,
            'DISPLAY': DISPLAY_NUM,
            'HOME': '/root',
            'QT_QPA_PLATFORM': 'xcb',
            'LIBGL_ALWAYS_SOFTWARE': '1',
        }
        obs = subprocess.Popen(
            ['obs', '--startstreaming', '--minimize-to-tray',
             '--collection', 'vk-stream', '--profile', 'vk-stream'],
            env=obs_env,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        with open(OBS_PID, 'w') as f:
            f.write(str(obs.pid))
        logger.info(f"OBS started pid={obs.pid} → {rtmp_target}")
        return jsonify({"status": "ok", "message": "Stream started"})

    except Exception as e:
        logger.error(f"Start error: {e}")
        kill_all()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/stop', methods=['GET', 'POST'])
def stop_stream():
    auth_err = check_auth()
    if auth_err:
        return auth_err
    kill_all()
    return jsonify({"status": "ok", "message": "Stream stopped"})


@app.route('/overlay/update', methods=['POST'])
def overlay_update():
    auth_err = check_auth()
    if auth_err:
        return auth_err
    data = request.json
    if not isinstance(data, dict) or not data:
        return jsonify({"status": "error", "message": "JSON object required"}), 400
    try:
        current = _get_match_state()
        merged = {**current, **data}
        _patch_match_state(merged)
        return jsonify({"status": "ok", "state": merged})
    except Exception as e:
        logger.error(f"overlay_update Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/score', methods=['POST'])
def update_score():
    auth_err = check_auth()
    if auth_err:
        return auth_err
    data = request.json
    team1_score = data.get('team1', 0)
    team2_score = data.get('team2', 0)
    try:
        current = _get_match_state()
        score = current.get('score', {})
        score['team1'] = team1_score
        score['team2'] = team2_score
        current['score'] = score
        _patch_match_state(current)
        return jsonify({"status": "ok", "score": {"team1": team1_score, "team2": team2_score}})
    except Exception as e:
        logger.error(f"Score update Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
