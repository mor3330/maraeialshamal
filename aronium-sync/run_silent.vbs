Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\AroniumSync"
WshShell.Run "python sync.py --daemon", 0, False
