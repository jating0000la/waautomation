REM ============================================
REM WhatsApp Bulk Messaging - LibreOffice Calc
REM For use with WhatsApp Web.js Multi-Account API
REM ============================================

Option Explicit

REM ============================================
REM CONFIGURATION - Update these values
REM ============================================
Global Const API_BASE_URL As String = "http://localhost:3000"
Global Const PHONE_ID As String = "9318430787"
Global Const API_TOKEN As String = "617d778590ffa01b5e51ddfee17d6e31774d86decf651b4e96bace1acd931596"

REM API Endpoints
Global Const API_ENDPOINT_MESSAGE As String = "/api/v2/send-message"
Global Const API_ENDPOINT_FILE As String = "/api/v2/send-file-by-url"

REM Timing Configuration (Anti-Detection)
Global Const MIN_DELAY As Integer = 3          REM Minimum delay between messages (seconds)
Global Const MAX_DELAY As Integer = 8          REM Maximum delay between messages (seconds)
Global Const LONG_BREAK_MIN As Integer = 30    REM Minimum long break duration (seconds)
Global Const LONG_BREAK_MAX As Integer = 60    REM Maximum long break duration (seconds)
Global Const MESSAGES_BEFORE_BREAK_MIN As Integer = 8   REM Min messages before long break
Global Const MESSAGES_BEFORE_BREAK_MAX As Integer = 12  REM Max messages before long break
Global Const VERY_LONG_BREAK_MIN As Integer = 120  REM 2 minutes - after every 50 messages
Global Const VERY_LONG_BREAK_MAX As Integer = 180  REM 3 minutes - after every 50 messages
Global Const MESSAGES_BEFORE_VERY_LONG_BREAK As Integer = 50

REM Sheet Names
Global Const SHEET_DATA As String = "Data"
Global Const SHEET_DND As String = "DND"
Global Const SHEET_TEMPLATE As String = "Template"

REM Column positions in Data sheet
Global Const COL_CONTACT As Integer = 0    REM A: Contact No (0-indexed)
Global Const COL_NAME As Integer = 1       REM B: Name
Global Const COL_FILEID As Integer = 2     REM C: File ID
Global Const COL_FILE_URL As Integer = 3   REM D: File URL (for sending files)
Global Const COL_HEADER1 As Integer = 4    REM E: Header1
Global Const COL_HEADER2 As Integer = 5    REM F: Header2
Global Const COL_HEADER3 As Integer = 6    REM G: Header3
Global Const COL_STATUS As Integer = 7     REM H: WhatsApp Status



REM ============================================
REM AUTO-SETUP: Create Sheet Structure (First Time)
REM ============================================
Sub SetupSpreadsheet()
    Dim oDoc As Object
    Dim oSheets As Object
    Dim oSheet As Object
    Dim response As Integer
    
    oDoc = ThisComponent
    oSheets = oDoc.Sheets
    
    REM Check if already set up
    If oSheets.hasByName(SHEET_DATA) And oSheets.hasByName(SHEET_DND) And oSheets.hasByName(SHEET_TEMPLATE) Then
        response = MsgBox("Sheets already exist. Do you want to recreate them?" & Chr(10) & Chr(10) & "WARNING: This will delete existing data!", 52, "Confirm Setup")
        If response = 7 Then Exit Sub REM 7 = No
        
        REM Delete existing sheets
        If oSheets.hasByName(SHEET_DATA) Then
            oSheets.removeByName(SHEET_DATA)
        End If
        If oSheets.hasByName(SHEET_DND) Then
            oSheets.removeByName(SHEET_DND)
        End If
        If oSheets.hasByName(SHEET_TEMPLATE) Then
            oSheets.removeByName(SHEET_TEMPLATE)
        End If
    End If
    
    REM Create Data Sheet
    If Not oSheets.hasByName(SHEET_DATA) Then
        oSheets.insertNewByName(SHEET_DATA, 0)
    End If
    oSheet = oSheets.getByName(SHEET_DATA)
    
    REM Set Data sheet headers
    oSheet.getCellByPosition(0, 0).setString("contact no")
    oSheet.getCellByPosition(1, 0).setString("name")
    oSheet.getCellByPosition(2, 0).setString("fileid")
    oSheet.getCellByPosition(3, 0).setString("file url")
    oSheet.getCellByPosition(4, 0).setString("header1")
    oSheet.getCellByPosition(5, 0).setString("header2")
    oSheet.getCellByPosition(6, 0).setString("header3")
    oSheet.getCellByPosition(7, 0).setString("whatsapp status")
    
    REM Format Data sheet headers
    Dim i As Integer
    For i = 0 To 7
        oSheet.getCellByPosition(i, 0).CharWeight = 150 REM Bold
        oSheet.getCellByPosition(i, 0).CellBackColor = RGB(200, 220, 255)
    Next i
    
    REM Add sample data
    oSheet.getCellByPosition(0, 1).setString("9876543210")
    oSheet.getCellByPosition(1, 1).setString("Raj Kumar")
    oSheet.getCellByPosition(2, 1).setString("F001")
    oSheet.getCellByPosition(3, 1).setString("")
    oSheet.getCellByPosition(4, 1).setString("Invoice")
    oSheet.getCellByPosition(5, 1).setString("₹500")
    oSheet.getCellByPosition(6, 1).setString("10/11/2025")
    
    oSheet.getCellByPosition(0, 2).setString("9123456789")
    oSheet.getCellByPosition(1, 2).setString("Priya Sharma")
    oSheet.getCellByPosition(2, 2).setString("F002")
    oSheet.getCellByPosition(3, 2).setString("https://example.com/invoice.pdf")
    oSheet.getCellByPosition(4, 2).setString("Payment")
    oSheet.getCellByPosition(5, 2).setString("₹1200")
    oSheet.getCellByPosition(6, 2).setString("11/11/2025")
    
    REM Auto-size columns
    For i = 0 To 7
        oSheet.Columns.getByIndex(i).OptimalWidth = True
    Next i
    
    REM Create DND Sheet
    If Not oSheets.hasByName(SHEET_DND) Then
        oSheets.insertNewByName(SHEET_DND, 1)
    End If
    oSheet = oSheets.getByName(SHEET_DND)
    
    REM Set DND sheet header
    oSheet.getCellByPosition(0, 0).setString("contact no")
    oSheet.getCellByPosition(0, 0).CharWeight = 150 REM Bold
    oSheet.getCellByPosition(0, 0).CellBackColor = RGB(255, 200, 200)
    
    REM Add sample DND number
    oSheet.getCellByPosition(0, 1).setString("9998887777")
    oSheet.Columns.getByIndex(0).OptimalWidth = True
    
    REM Create Template Sheet
    If Not oSheets.hasByName(SHEET_TEMPLATE) Then
        oSheets.insertNewByName(SHEET_TEMPLATE, 2)
    End If
    oSheet = oSheets.getByName(SHEET_TEMPLATE)
    
    REM Set template
    Dim templateText As String
    templateText = "Hello {{name}}," & Chr(10) & Chr(10) & _
                   "Your {{header1}} of {{header2}} is due on {{header3}}." & Chr(10) & _
                   "Please check file ID {{fileid}}." & Chr(10) & Chr(10) & _
                   "For any queries, contact us." & Chr(10) & Chr(10) & _
                   "Thank you," & Chr(10) & _
                   "Team"
    
    oSheet.getCellByPosition(0, 0).setString(templateText)
    oSheet.getCellByPosition(0, 0).CharWeight = 150
    oSheet.getCellByPosition(0, 0).CellBackColor = RGB(255, 255, 200)
    
    REM Merge cells for better template view
    Dim oCellRange As Object
    oCellRange = oSheet.getCellRangeByPosition(0, 0, 5, 10)
    oSheet.getCellByPosition(0, 0).Rows(0).Height = 3000 REM Increase row height
    
    REM Set column widths
    oSheet.Columns.getByIndex(0).Width = 8000
    
    REM Add instructions
    oSheet.getCellByPosition(0, 12).setString("Instructions:")
    oSheet.getCellByPosition(0, 12).CharWeight = 150
    oSheet.getCellByPosition(0, 13).setString("1. Edit the message template in cell A1 above")
    oSheet.getCellByPosition(0, 14).setString("2. Use {{placeholders}} to insert dynamic data")
    oSheet.getCellByPosition(0, 15).setString("3. Available: {{name}}, {{fileid}}, {{header1}}, {{header2}}, {{header3}}, {{contact}}")
    oSheet.getCellByPosition(0, 16).setString("4. To send files, add file URLs in the 'file url' column (column D)")
    oSheet.getCellByPosition(0, 17).setString("5. If file url is present, file will be sent with the message as caption")
    
    REM Switch to Data sheet
    oDoc.CurrentController.setActiveSheet(oSheets.getByName(SHEET_DATA))
    
    MsgBox "Spreadsheet setup complete!" & Chr(10) & Chr(10) & _
           "✅ Data sheet created with sample data" & Chr(10) & _
           "✅ DND sheet created" & Chr(10) & _
           "✅ Template sheet created with sample template" & Chr(10) & Chr(10) & _
           "Next steps:" & Chr(10) & _
           "1. Replace sample data in Data sheet" & Chr(10) & _
           "2. Add DND numbers in DND sheet (if any)" & Chr(10) & _
           "3. Customize message in Template sheet" & Chr(10) & _
           "4. Run TestSingleMessage to test" & Chr(10) & _
           "5. Run SendBulkWhatsAppMessages to send all", _
           64, "Setup Complete"
End Sub

REM ============================================
REM MAIN FUNCTION - Start Bulk Messaging
REM ============================================
Sub SendBulkWhatsAppMessages()
    Dim oDoc As Object
    Dim oSheets As Object
    Dim oDataSheet As Object, oDNDSheet As Object, oTemplateSheet As Object
    Dim lastRow As Long, currentRow As Long
    Dim messageCount As Integer, breakThreshold As Integer
    Dim contactNo As String, messageText As String, templateText As String
    Dim startTime As Double
    Dim totalContacts As Long
    Dim response As Integer
    
    On Error Goto ErrorHandler
    
    REM Initialize
    oDoc = ThisComponent
    oSheets = oDoc.Sheets
    
    REM Auto-create sheets if they don't exist
    If Not oSheets.hasByName(SHEET_DATA) Or Not oSheets.hasByName(SHEET_DND) Or Not oSheets.hasByName(SHEET_TEMPLATE) Then
        response = MsgBox("Required sheets not found!" & Chr(10) & Chr(10) & _
                         "Do you want to create the sheet structure now?", 36, "Setup Required")
        If response = 6 Then REM 6 = Yes
            SetupSpreadsheet()
            MsgBox "Please add your contact data and run again.", 48, "Setup Complete"
            Exit Sub
        Else
            MsgBox "Cannot proceed without required sheets (Data, DND, Template)", 16, "Error"
            Exit Sub
        End If
    End If
    
    oDataSheet = oSheets.getByName(SHEET_DATA)
    oDNDSheet = oSheets.getByName(SHEET_DND)
    oTemplateSheet = oSheets.getByName(SHEET_TEMPLATE)
    
    REM Get template
    templateText = oTemplateSheet.getCellByPosition(0, 0).getString()
    If Len(templateText) = 0 Then
        MsgBox "Template is empty! Please add message template in Template sheet, Cell A1.", 16, "Error"
        Exit Sub
    End If
    
    REM Find last row with data
    lastRow = GetLastRow(oDataSheet, COL_CONTACT)
    totalContacts = lastRow - 1 REM Exclude header
    
    If totalContacts <= 0 Then
        MsgBox "No contacts found in Data sheet!", 48, "Warning"
        Exit Sub
    End If
    
    REM Confirmation with timing estimate
    Dim estimatedMinutes As Long
    estimatedMinutes = Int((totalContacts * ((MIN_DELAY + MAX_DELAY) / 2) + _
                           (totalContacts / MESSAGES_BEFORE_BREAK_MAX * LONG_BREAK_MAX) + _
                           (totalContacts / MESSAGES_BEFORE_VERY_LONG_BREAK * VERY_LONG_BREAK_MAX)) / 60)
    
    response = MsgBox("Ready to send messages to " & totalContacts & " contacts." & Chr(10) & Chr(10) & _
                     "⏱️ Estimated time: ~" & estimatedMinutes & " minutes" & Chr(10) & Chr(10) & _
                     "📋 Timing Strategy:" & Chr(10) & _
                     "   • " & MIN_DELAY & "-" & MAX_DELAY & " sec between messages" & Chr(10) & _
                     "   • " & LONG_BREAK_MIN & "-" & LONG_BREAK_MAX & " sec breaks every " & MESSAGES_BEFORE_BREAK_MAX & " msgs" & Chr(10) & _
                     "   • " & Int(VERY_LONG_BREAK_MIN/60) & "-" & Int(VERY_LONG_BREAK_MAX/60) & " min breaks every " & MESSAGES_BEFORE_VERY_LONG_BREAK & " msgs" & Chr(10) & Chr(10) & _
                     "Continue?", 36, "Confirm Bulk Send")
    If response = 7 Then Exit Sub REM 7 = No
    
    REM Initialize counters
    messageCount = 0
    breakThreshold = GetRandomNumber(MESSAGES_BEFORE_BREAK_MIN, MESSAGES_BEFORE_BREAK_MAX)
    startTime = Timer
    
    REM Loop through contacts
    For currentRow = 1 To lastRow - 1 REM Start from 1 (skip header at 0)
        contactNo = Trim(CStr(oDataSheet.getCellByPosition(COL_CONTACT, currentRow).getString()))
        
        REM Skip if empty
        If Len(contactNo) = 0 Then
            Goto NextContact
        End If
        
        REM Skip if already sent
        If InStr(oDataSheet.getCellByPosition(COL_STATUS, currentRow).getString(), "Sent ✅") > 0 Then
            Goto NextContact
        End If
        
        REM Check DND list
        If IsNumberInDND(contactNo, oDNDSheet) Then
            oDataSheet.getCellByPosition(COL_STATUS, currentRow).setString("DND 🚫")
            SetCellColor(oDataSheet, COL_STATUS, currentRow, RGB(255, 200, 200))
            Goto NextContact
        End If
        
        REM Prepare message
        messageText = ReplaceTemplatePlaceholders(templateText, oDataSheet, currentRow)
        
        REM Update status
        oDataSheet.getCellByPosition(COL_STATUS, currentRow).setString("Sending...")
        SetCellColor(oDataSheet, COL_STATUS, currentRow, RGB(255, 255, 200))
        
        REM Check if file URL is provided
        Dim fileUrl As String
        fileUrl = Trim(oDataSheet.getCellByPosition(COL_FILE_URL, currentRow).getString())
        
        REM Send message or file
        Dim sendResult As Boolean
        If Len(fileUrl) > 0 Then
            REM Send file with message as caption
            sendResult = SendWhatsAppFile(contactNo, fileUrl, messageText, oDataSheet, currentRow)
        Else
            REM Send text message only
            sendResult = SendWhatsAppMessage(contactNo, messageText, oDataSheet, currentRow)
        End If
        
        REM Always apply delay mechanism regardless of success/failure
        messageCount = messageCount + 1
        
        REM Random delay between messages (3-8 seconds)
        Dim randomDelay As Integer
        randomDelay = GetRandomNumber(MIN_DELAY, MAX_DELAY)
        
        REM Show countdown with appropriate emoji
        If sendResult Then
            oDataSheet.getCellByPosition(COL_STATUS, currentRow).setString("✅ Wait " & randomDelay & "s")
        Else
            REM Keep the failed status visible but add wait indicator
            Dim currentStatus As String
            currentStatus = oDataSheet.getCellByPosition(COL_STATUS, currentRow).getString()
            oDataSheet.getCellByPosition(COL_STATUS, currentRow).setString(currentStatus & " (Wait " & randomDelay & "s)")
        End If
        
        Sleep randomDelay
        
        REM Very long break after every 50 messages (2-3 minutes)
        If messageCount Mod MESSAGES_BEFORE_VERY_LONG_BREAK = 0 Then
            Dim veryLongBreak As Integer
            veryLongBreak = GetRandomNumber(VERY_LONG_BREAK_MIN, VERY_LONG_BREAK_MAX)
            
            MsgBox "✋ Extended Break!" & Chr(10) & Chr(10) & _
                   "Processed " & messageCount & " messages so far." & Chr(10) & _
                   "Taking a " & Int(veryLongBreak / 60) & " minute break to avoid detection..." & Chr(10) & Chr(10) & _
                   "This helps maintain account safety!", 48, "Break Time"
            
            Sleep veryLongBreak
            
            REM Reset threshold after very long break
            breakThreshold = GetRandomNumber(MESSAGES_BEFORE_BREAK_MIN, MESSAGES_BEFORE_BREAK_MAX)
            
        REM Regular long break after 8-12 messages (30-60 seconds)
        ElseIf messageCount Mod breakThreshold = 0 Then
            Dim longBreak As Integer
            longBreak = GetRandomNumber(LONG_BREAK_MIN, LONG_BREAK_MAX)
            
            REM Update status to show break
            If sendResult Then
                oDataSheet.getCellByPosition(COL_STATUS, currentRow).setString("⏸️ Break " & longBreak & "s")
            Else
                currentStatus = oDataSheet.getCellByPosition(COL_STATUS, currentRow).getString()
                oDataSheet.getCellByPosition(COL_STATUS, currentRow).setString(currentStatus & " (Break " & longBreak & "s)")
            End If
            
            Sleep longBreak
            
            REM Set new random threshold
            breakThreshold = GetRandomNumber(MESSAGES_BEFORE_BREAK_MIN, MESSAGES_BEFORE_BREAK_MAX)
        End If
        
        REM Final status update - only for successful messages
        If sendResult Then
            If Len(fileUrl) > 0 Then
                oDataSheet.getCellByPosition(COL_STATUS, currentRow).setString("Sent ✅ (File)")
                SetCellColor(oDataSheet, COL_STATUS, currentRow, RGB(200, 255, 200))
            Else
                oDataSheet.getCellByPosition(COL_STATUS, currentRow).setString("Sent ✅")
                SetCellColor(oDataSheet, COL_STATUS, currentRow, RGB(200, 255, 200))
            End If
        Else
            REM Clean up the wait/break text from failed status
            currentStatus = oDataSheet.getCellByPosition(COL_STATUS, currentRow).getString()
            If InStr(currentStatus, "(Wait") > 0 Or InStr(currentStatus, "(Break") > 0 Then
                REM Extract just the status part before the parentheses
                Dim cleanStatus As String
                Dim parenPos As Integer
                parenPos = InStr(currentStatus, " (")
                If parenPos > 0 Then
                    cleanStatus = Left(currentStatus, parenPos - 1)
                    oDataSheet.getCellByPosition(COL_STATUS, currentRow).setString(cleanStatus)
                End If
            End If
        End If
        
NextContact:
    Next currentRow
    
    REM Complete
    Dim elapsedTime As Long
    Dim sentCount As Long, failedCount As Long
    elapsedTime = Timer - startTime
    
    REM Count actual results
    sentCount = 0
    failedCount = 0
    For currentRow = 1 To lastRow - 1
        Dim finalStatus As String
        finalStatus = oDataSheet.getCellByPosition(COL_STATUS, currentRow).getString()
        If InStr(finalStatus, "Sent ✅") > 0 Then
            sentCount = sentCount + 1
        ElseIf InStr(finalStatus, "Failed") > 0 Or InStr(finalStatus, "Error") > 0 Then
            failedCount = failedCount + 1
        End If
    Next currentRow
    
    MsgBox "✅ Bulk messaging complete!" & Chr(10) & Chr(10) & _
           "📊 Summary:" & Chr(10) & _
           "   • Total contacts: " & totalContacts & Chr(10) & _
           "   • Successfully sent: " & sentCount & " ✅" & Chr(10) & _
           "   • Failed: " & failedCount & " ❌" & Chr(10) & _
           "   • Success rate: " & Format(sentCount / totalContacts * 100, "0.0") & "%" & Chr(10) & Chr(10) & _
           "⏱️ Time elapsed: " & Format(elapsedTime / 60, "0.0") & " minutes", _
           64, "Campaign Complete"
    Exit Sub
    
ErrorHandler:
    MsgBox "Error: " & Error$ & Chr(10) & "Error Number: " & Err, 16, "Error"
End Sub

REM ============================================
REM SEND WHATSAPP MESSAGE VIA API
REM ============================================
Function SendWhatsAppMessage(phoneNumber As String, messageText As String, oSheet As Object, rowNum As Long) As Boolean
    Dim oSimpleFileAccess As Object
    Dim oRequest As Object
    Dim url As String
    Dim jsonBody As String
    Dim responseText As String
    Dim statusCode As Integer
    
    On Error Goto ErrorHandler
    
    REM Format phone number (ensure it has country code)
    REM Remove spaces and special characters
    phoneNumber = Replace(phoneNumber, " ", "")
    phoneNumber = Replace(phoneNumber, "-", "")
    phoneNumber = Replace(phoneNumber, "+", "")
    
    REM Add country code if not present
    If Left(phoneNumber, 2) <> "91" And Len(phoneNumber) = 10 Then
        phoneNumber = "91" & phoneNumber
    End If
    
    REM Create HTTP request using LibreOffice API
    url = API_BASE_URL & API_ENDPOINT_MESSAGE
    
    REM Prepare JSON body
    jsonBody = "{" & _
               """to"":""" & phoneNumber & """," & _
               """message"":""" & EscapeJSON(messageText) & """" & _
               "}"
    
    REM Send HTTP request
    Dim result As Boolean
    result = SendHTTPRequest(url, jsonBody, responseText, statusCode)
    
    REM Check response - look for success in JSON response
    If statusCode = 200 And InStr(responseText, """success"":true") > 0 Then
        SendWhatsAppMessage = True
    ElseIf statusCode = 200 And InStr(responseText, """success"":false") > 0 Then
        REM API returned 200 but success=false
        oSheet.getCellByPosition(COL_STATUS, rowNum).setString("Failed ❌")
        SetCellColor(oSheet, COL_STATUS, rowNum, RGB(255, 200, 200))
        SendWhatsAppMessage = False
    ElseIf statusCode > 0 Then
        REM Got HTTP response but not successful
        oSheet.getCellByPosition(COL_STATUS, rowNum).setString("Failed ❌ (" & statusCode & ")")
        SetCellColor(oSheet, COL_STATUS, rowNum, RGB(255, 200, 200))
        SendWhatsAppMessage = False
    Else
        REM No response or connection error
        oSheet.getCellByPosition(COL_STATUS, rowNum).setString("Error ❌")
        SetCellColor(oSheet, COL_STATUS, rowNum, RGB(255, 200, 200))
        SendWhatsAppMessage = False
    End If
    
    Exit Function
    
ErrorHandler:
    oSheet.getCellByPosition(COL_STATUS, rowNum).setString("Error ❌")
    SetCellColor(oSheet, COL_STATUS, rowNum, RGB(255, 200, 200))
    SendWhatsAppMessage = False
End Function

REM ============================================
REM SEND WHATSAPP FILE VIA API
REM ============================================
Function SendWhatsAppFile(phoneNumber As String, fileUrl As String, caption As String, oSheet As Object, rowNum As Long) As Boolean
    Dim url As String
    Dim jsonBody As String
    Dim responseText As String
    Dim statusCode As Integer
    
    On Error Goto ErrorHandler
    
    REM Format phone number (ensure it has country code)
    REM Remove spaces and special characters
    phoneNumber = Replace(phoneNumber, " ", "")
    phoneNumber = Replace(phoneNumber, "-", "")
    phoneNumber = Replace(phoneNumber, "+", "")
    
    REM Add country code if not present
    If Left(phoneNumber, 2) <> "91" And Len(phoneNumber) = 10 Then
        phoneNumber = "91" & phoneNumber
    End If
    
    REM Create HTTP request using LibreOffice API
    url = API_BASE_URL & API_ENDPOINT_FILE
    
    REM Prepare JSON body
    jsonBody = "{" & _
               """to"":""" & phoneNumber & """," & _
               """url"":""" & EscapeJSON(fileUrl) & """," & _
               """caption"":""" & EscapeJSON(caption) & """" & _
               "}"
    
    REM Send HTTP request
    Dim result As Boolean
    result = SendHTTPRequest(url, jsonBody, responseText, statusCode)
    
    REM Check response - look for success in JSON response
    If statusCode = 200 And InStr(responseText, """success"":true") > 0 Then
        SendWhatsAppFile = True
    ElseIf statusCode = 200 And InStr(responseText, """success"":false") > 0 Then
        REM API returned 200 but success=false
        oSheet.getCellByPosition(COL_STATUS, rowNum).setString("Failed ❌")
        SetCellColor(oSheet, COL_STATUS, rowNum, RGB(255, 200, 200))
        SendWhatsAppFile = False
    ElseIf statusCode > 0 Then
        REM Got HTTP response but not successful
        oSheet.getCellByPosition(COL_STATUS, rowNum).setString("Failed ❌ (" & statusCode & ")")
        SetCellColor(oSheet, COL_STATUS, rowNum, RGB(255, 200, 200))
        SendWhatsAppFile = False
    Else
        REM No response or connection error
        oSheet.getCellByPosition(COL_STATUS, rowNum).setString("Error ❌")
        SetCellColor(oSheet, COL_STATUS, rowNum, RGB(255, 200, 200))
        SendWhatsAppFile = False
    End If
    
    Exit Function
    
ErrorHandler:
    oSheet.getCellByPosition(COL_STATUS, rowNum).setString("Error ❌")
    SetCellColor(oSheet, COL_STATUS, rowNum, RGB(255, 200, 200))
    SendWhatsAppFile = False
End Function

REM ============================================
REM SEND HTTP REQUEST (LibreOffice Compatible)
REM ============================================
Function SendHTTPRequest(url As String, jsonBody As String, responseText As String, statusCode As Integer) As Boolean
    On Error Goto ErrorHandler
    
    REM Use PowerShell via WScript.Shell for better reliability on Windows
    Dim psCmd As String
    Dim tempFile As String
    Dim outputFile As String
    Dim psScriptFile As String
    
    REM Create temp files with unique timestamp
    Dim timestamp As String
    timestamp = Format(Now, "yyyymmddhhnnss") & Right(CStr(Timer * 1000), 3)
    tempFile = Environ("TEMP") & "\wa_request_" & timestamp & ".json"
    outputFile = Environ("TEMP") & "\wa_response_" & timestamp & ".txt"
    psScriptFile = Environ("TEMP") & "\wa_curl_" & timestamp & ".ps1"
    
    REM Write JSON to temp file
    Dim FileNo As Integer
    FileNo = FreeFile
    Open tempFile For Output As #FileNo
    Print #FileNo, jsonBody
    Close #FileNo
    
    REM Create PowerShell script for curl
    FileNo = FreeFile
    Open psScriptFile For Output As #FileNo
    Print #FileNo, "$ErrorActionPreference = 'Stop'"
    Print #FileNo, "try {"
    Print #FileNo, "  $headers = @{"
    Print #FileNo, "    'Content-Type' = 'application/json'"
    Print #FileNo, "    'phone-id' = '" & PHONE_ID & "'"
    Print #FileNo, "    'token' = '" & API_TOKEN & "'"
    Print #FileNo, "  }"
    Print #FileNo, "  $body = Get-Content -Path '" & tempFile & "' -Raw"
    Print #FileNo, "  $response = Invoke-WebRequest -Uri '" & url & "' -Method Post -Headers $headers -Body $body -UseBasicParsing"
    Print #FileNo, "  $output = @{"
    Print #FileNo, "    'StatusCode' = $response.StatusCode"
    Print #FileNo, "    'Body' = $response.Content"
    Print #FileNo, "  } | ConvertTo-Json -Compress"
    Print #FileNo, "  $output | Out-File -FilePath '" & outputFile & "' -Encoding UTF8"
    Print #FileNo, "  exit 0"
    Print #FileNo, "} catch {"
    Print #FileNo, "  $errorOutput = @{"
    Print #FileNo, "    'StatusCode' = if($_.Exception.Response.StatusCode.value__){$_.Exception.Response.StatusCode.value__}else{500}"
    Print #FileNo, "    'Body' = $_.Exception.Message"
    Print #FileNo, "  } | ConvertTo-Json -Compress"
    Print #FileNo, "  $errorOutput | Out-File -FilePath '" & outputFile & "' -Encoding UTF8"
    Print #FileNo, "  exit 1"
    Print #FileNo, "}"
    Close #FileNo
    
    REM Execute PowerShell script
    Dim shellObj As Object
    Dim execResult As Integer
    Set shellObj = CreateObject("WScript.Shell")
    
    REM Run PowerShell and wait for completion
    psCmd = "powershell.exe -ExecutionPolicy Bypass -NoProfile -File " & Chr(34) & psScriptFile & Chr(34)
    execResult = shellObj.Run(psCmd, 0, True)
    
    REM Wait for file to be written
    Wait 1000
    
    REM Read response
    responseText = ""
    statusCode = 0
    
    On Error Resume Next
    FileNo = FreeFile
    Open outputFile For Input As #FileNo
    If Err.Number = 0 Then
        Dim fullResponse As String
        fullResponse = ""
        Dim line As String
        Do While Not EOF(FileNo)
            Line Input #FileNo, line
            fullResponse = fullResponse & line
        Loop
        Close #FileNo
        
        REM Parse JSON response
        If Len(fullResponse) > 0 Then
            REM Extract StatusCode
            Dim statusPos As Integer
            statusPos = InStr(fullResponse, """StatusCode"":")
            If statusPos > 0 Then
                Dim statusStart As Integer
                Dim statusEnd As Integer
                statusStart = statusPos + 14
                statusEnd = InStr(statusStart, fullResponse, ",")
                If statusEnd = 0 Then statusEnd = InStr(statusStart, fullResponse, "}")
                If statusEnd > statusStart Then
                    statusCode = CInt(Mid(fullResponse, statusStart, statusEnd - statusStart))
                End If
            End If
            
            REM Extract Body
            Dim bodyPos As Integer
            bodyPos = InStr(fullResponse, """Body"":")
            If bodyPos > 0 Then
                Dim bodyStart As Integer
                bodyStart = InStr(bodyPos, fullResponse, ":") + 1
                REM Skip quotes and spaces
                Do While Mid(fullResponse, bodyStart, 1) = " " Or Mid(fullResponse, bodyStart, 1) = Chr(34)
                    bodyStart = bodyStart + 1
                Loop
                Dim bodyEnd As Integer
                bodyEnd = InStrRev(fullResponse, Chr(34))
                If bodyEnd > bodyStart Then
                    responseText = Mid(fullResponse, bodyStart, bodyEnd - bodyStart)
                    REM Unescape JSON
                    responseText = Replace(responseText, "\""", Chr(34))
                    responseText = Replace(responseText, "\\", "\")
                End If
            End If
        End If
    End If
    On Error Goto ErrorHandler
    
    REM Clean up temp files
    On Error Resume Next
    Kill tempFile
    Kill outputFile
    Kill psScriptFile
    On Error Goto ErrorHandler
    
    REM Return success if we got a response
    If statusCode > 0 Then
        SendHTTPRequest = True
    Else
        SendHTTPRequest = False
    End If
    
    Exit Function
    
ErrorHandler:
    responseText = "Error: " & Error$ & " (Code: " & Err & ")"
    statusCode = 0
    
    REM Try to clean up
    On Error Resume Next
    Kill tempFile
    Kill outputFile
    Kill psScriptFile
    On Error Goto 0
    
    SendHTTPRequest = False
End Function

REM ============================================
REM CHECK IF NUMBER IN DND LIST
REM ============================================
Function IsNumberInDND(phoneNumber As String, oDNDSheet As Object) As Boolean
    Dim lastRow As Long
    Dim i As Long
    Dim dndNumber As String
    
    IsNumberInDND = False
    phoneNumber = Trim(Replace(phoneNumber, " ", ""))
    
    lastRow = GetLastRow(oDNDSheet, 0)
    
    For i = 1 To lastRow - 1 REM Start from 1 (skip header)
        dndNumber = Trim(Replace(oDNDSheet.getCellByPosition(0, i).getString(), " ", ""))
        If Len(dndNumber) > 0 And (dndNumber = phoneNumber Or _
           Right(phoneNumber, 10) = Right(dndNumber, 10)) Then
            IsNumberInDND = True
            Exit Function
        End If
    Next i
End Function

REM ============================================
REM REPLACE TEMPLATE PLACEHOLDERS
REM ============================================
Function ReplaceTemplatePlaceholders(template As String, oSheet As Object, rowNum As Long) As String
    Dim result As String
    result = template
    
    REM Replace placeholders with actual values
    result = Replace(result, "{{name}}", oSheet.getCellByPosition(COL_NAME, rowNum).getString())
    result = Replace(result, "{{fileid}}", oSheet.getCellByPosition(COL_FILEID, rowNum).getString())
    result = Replace(result, "{{file_url}}", oSheet.getCellByPosition(COL_FILE_URL, rowNum).getString())
    result = Replace(result, "{{header1}}", oSheet.getCellByPosition(COL_HEADER1, rowNum).getString())
    result = Replace(result, "{{header2}}", oSheet.getCellByPosition(COL_HEADER2, rowNum).getString())
    result = Replace(result, "{{header3}}", oSheet.getCellByPosition(COL_HEADER3, rowNum).getString())
    result = Replace(result, "{{contact}}", oSheet.getCellByPosition(COL_CONTACT, rowNum).getString())
    
    ReplaceTemplatePlaceholders = result
End Function

REM ============================================
REM ESCAPE JSON SPECIAL CHARACTERS
REM ============================================
Function EscapeJSON(text As String) As String
    text = Replace(text, "\", "\\")
    text = Replace(text, """", "\""")
    text = Replace(text, Chr(13) & Chr(10), "\n")
    text = Replace(text, Chr(13), "\n")
    text = Replace(text, Chr(10), "\n")
    text = Replace(text, Chr(9), "\t")
    EscapeJSON = text
End Function

REM ============================================
REM GENERATE RANDOM NUMBER
REM ============================================
Function GetRandomNumber(minVal As Integer, maxVal As Integer) As Integer
    Randomize
    GetRandomNumber = Int((maxVal - minVal + 1) * Rnd + minVal)
End Function

REM ============================================
REM SLEEP FUNCTION (in seconds)
REM ============================================
Sub Sleep(seconds As Integer)
    Dim endTime As Double
    endTime = Timer + seconds
    Do While Timer < endTime
        Wait 100 REM Wait 100ms
    Loop
End Sub

REM ============================================
REM GET LAST ROW WITH DATA
REM ============================================
Function GetLastRow(oSheet As Object, colIndex As Integer) As Long
    Dim oCell As Object
    Dim i As Long
    
    For i = 0 To 10000 REM Max 10000 rows
        oCell = oSheet.getCellByPosition(colIndex, i)
        If Len(Trim(oCell.getString())) = 0 Then
            GetLastRow = i
            Exit Function
        End If
    Next i
    
    GetLastRow = 10000
End Function

REM ============================================
REM SET CELL BACKGROUND COLOR
REM ============================================
Sub SetCellColor(oSheet As Object, colIndex As Integer, rowIndex As Long, color As Long)
    Dim oCell As Object
    oCell = oSheet.getCellByPosition(colIndex, rowIndex)
    oCell.CellBackColor = color
End Sub

REM ============================================
REM RGB COLOR FUNCTION
REM ============================================
Function RGB(r As Integer, g As Integer, b As Integer) As Long
    RGB = r + (g * 256) + (b * 65536)
End Function

REM ============================================
REM UTILITY: Clear All Status
REM ============================================
Sub ClearAllStatus()
    Dim oDoc As Object
    Dim oSheets As Object
    Dim oSheet As Object
    Dim lastRow As Long
    Dim i As Long
    Dim response As Integer
    
    oDoc = ThisComponent
    oSheets = oDoc.Sheets
    
    REM Auto-create sheets if they don't exist
    If Not oSheets.hasByName(SHEET_DATA) Then
        response = MsgBox("Data sheet not found!" & Chr(10) & Chr(10) & _
                         "Do you want to create the sheet structure now?", 36, "Setup Required")
        If response = 6 Then REM 6 = Yes
            SetupSpreadsheet()
        End If
        Exit Sub
    End If
    
    oSheet = oSheets.getByName(SHEET_DATA)
    
    lastRow = GetLastRow(oSheet, COL_CONTACT)
    
    response = MsgBox("Clear all status for " & (lastRow - 1) & " contacts?", 36, "Confirm Clear")
    If response = 7 Then Exit Sub REM 7 = No
    
    For i = 1 To lastRow - 1
        oSheet.getCellByPosition(COL_STATUS, i).setString("")
        oSheet.getCellByPosition(COL_STATUS, i).CellBackColor = -1 REM Default color
    Next i
    
    MsgBox "Status cleared!", 64, "Success"
End Sub

REM ============================================
REM UTILITY: Show Statistics
REM ============================================
Sub ShowStatistics()
    Dim oDoc As Object
    Dim oSheets As Object
    Dim oSheet As Object
    Dim lastRow As Long
    Dim i As Long
    Dim totalContacts As Long, sentCount As Long, failedCount As Long
    Dim pendingCount As Long, dndCount As Long, fileCount As Long
    Dim statusValue As String
    Dim successRate As String
    Dim response As Integer
    
    oDoc = ThisComponent
    oSheets = oDoc.Sheets
    
    REM Auto-create sheets if they don't exist
    If Not oSheets.hasByName(SHEET_DATA) Then
        response = MsgBox("Data sheet not found!" & Chr(10) & Chr(10) & _
                         "Do you want to create the sheet structure now?", 36, "Setup Required")
        If response = 6 Then REM 6 = Yes
            SetupSpreadsheet()
        End If
        Exit Sub
    End If
    
    oSheet = oSheets.getByName(SHEET_DATA)
    
    lastRow = GetLastRow(oSheet, COL_CONTACT)
    
    For i = 1 To lastRow - 1
        If Len(oSheet.getCellByPosition(COL_CONTACT, i).getString()) > 0 Then
            totalContacts = totalContacts + 1
            
            statusValue = oSheet.getCellByPosition(COL_STATUS, i).getString()
            
            If statusValue = "Sent ✅" Then
                sentCount = sentCount + 1
            ElseIf statusValue = "Sent ✅ (File)" Then
                sentCount = sentCount + 1
                fileCount = fileCount + 1
            ElseIf statusValue = "Failed ❌" Or statusValue = "Error ❌" Then
                failedCount = failedCount + 1
            ElseIf statusValue = "DND 🚫" Then
                dndCount = dndCount + 1
            Else
                pendingCount = pendingCount + 1
            End If
        End If
    Next i
    
    If (totalContacts - dndCount) > 0 Then
        successRate = Format(sentCount / (totalContacts - dndCount) * 100, "0.0") & "%"
    Else
        successRate = "0.0%"
    End If
    
    MsgBox "📊 Campaign Statistics" & Chr(10) & Chr(10) & _
           "Total Contacts: " & totalContacts & Chr(10) & _
           "Sent: " & sentCount & " ✅" & Chr(10) & _
           "  - With Files: " & fileCount & " 📎" & Chr(10) & _
           "Failed: " & failedCount & " ❌" & Chr(10) & _
           "DND: " & dndCount & " 🚫" & Chr(10) & _
           "Pending: " & pendingCount & Chr(10) & Chr(10) & _
           "Success Rate: " & successRate, _
           64, "Statistics"
End Sub
