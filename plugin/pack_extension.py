import os
import shutil
import json
from subprocess import call

NAME = "Godville Dungeon Planner"
VERSION = "0.1"
DESCRIPTION = ""

JS = [
    "setenv.js",
    "../web/static/js/gvd.js",
    "../web/static/js/sha1.js",
    "../web/static/js/wson.js",
    "../web/static/js/run.js",
]

CSS = [
    "gvd.css",
]

IMG_DIR = "../web/static/img"
SOUND_DIR = "../web/static/sounds"

CHROME = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
KEY_PATH = "gvd.pem"

########################

PATH = ".extension"


def clear_folder(folder):
    for name in os.listdir(folder):
        file = os.path.join(folder, name)
        if os.path.isfile(file):
            os.unlink(file)
        elif os.path.isdir(file):
            shutil.rmtree(file)


def copy_files(file_list, destination):
    os.makedirs(destination)
    new_list = []
    for file in file_list:
        new_path = shutil.copy(file, destination)
        new_path = new_path.replace(PATH, "")
        new_list.append(new_path)
    return new_list


def copy_folder(folder, destination):
    file_list = []
    for name in os.listdir(folder):
        file_list.append(os.path.join(folder, name))
    return copy_files(file_list, destination)


if __name__ == "__main__":

    print("Clearing...")

    if not os.path.exists(PATH):
        os.makedirs(PATH)
    else:
        clear_folder(PATH)

    print("Copying files...")

    new_js = copy_files(JS, os.path.join(PATH, "js"))
    new_css = copy_files(CSS, os.path.join(PATH, "css"))

    new_img = copy_folder(IMG_DIR, os.path.join(PATH, "img"))
    new_sound = copy_folder(SOUND_DIR, os.path.join(PATH, "sounds"))

    print("Creating manifest...")

    manifest = {
        "content_scripts": [
            {
                "css": new_css,
                "js": new_js,
                "matches": [
                    "http://godville.net/superhero",
                    "https://godville.net/superhero"
                ]
            }
        ],
        "description": DESCRIPTION,
        "manifest_version": 2,
        "name": NAME,
        "version": VERSION,
        "web_accessible_resources": new_js + new_css + new_img + new_sound
    }

    mf = open(os.path.join(PATH, "manifest.json"), 'w')
    mf.write(json.dumps(manifest, indent=2).replace("\\\\", "/"))
    mf.close()

    print("Packing...")
    call([
        CHROME,
        "--pack-extension=" + os.path.realpath(PATH),
        "--pack-extension-key=" + os.path.realpath(KEY_PATH),
    ])

#    TODO: Delete folder after packing

    print("Done")
