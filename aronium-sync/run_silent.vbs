' run_silent.vbs - يشغّل sync.py بدون نافذة CMD مرئية
' مراعي الشمال - نظام المزامنة

Dim objShell
Set objShell = CreateObject("WScript.Shell")

' مسار ثابت
Dim syncDir
syncDir = "C:\AroniumSync"

' شغّل Python بدون نافذة (0 = مخفي)
objShell.Run "python """ & syncDir & "\sync.py""", 0, False

Set objShell = Nothing
