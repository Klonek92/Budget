@echo off
set commit_msg=Automatisches Update %date% %time%

echo Fuege Aenderungen hinzu...
git add .

echo Erstelle Commit...
git commit -m "%commit_msg%"

echo Übertrage zu Git...
git push origin main

echo.
echo Prozess erfolgreich abgeschlossen!
pause