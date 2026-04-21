import sys

from google.auth import default
from googleapiclient.discovery import build


def main():
    creds, project = default(
        scopes=[
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/spreadsheets",
        ]
    )
    drive = build("drive", "v3", credentials=creds)
    about = drive.about().get(fields="user").execute()
    print("Drive identity:", about.get("user", {}))
    print("Google project:", project)
    print("Sheets auth OK.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("Auth check error:", exc)
        sys.exit(1)
