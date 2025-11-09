' ============================================
' WhatsApp Bulk Messaging VBA Script
' For use with WhatsApp Web.js Multi-Account API
' ============================================

Option Explicit

' ============================================
' CONFIGURATION - Update these values
' ============================================
Const API_BASE_URL As String = "http://localhost:3000"
Const PHONE_ID As String = "9318430787"
Const API_TOKEN As String = "617d778590ffa01b5e51ddfee17d6e31774d86decf651b4e96bace1acd931596"
Const API_ENDPOINT As String = "/api/v2/send-message"

' Timing Configuration
Const MIN_DELAY As Integer = 2          ' Minimum delay between messages (seconds)
Const MAX_DELAY As Integer = 6          ' Maximum delay between messages (seconds)
Const LONG_BREAK_MIN As Integer = 15    ' Minimum long break duration (seconds)
Const LONG_BREAK_MAX As Integer = 25    ' Maximum long break duration (seconds)
Const MESSAGES_BEFORE_BREAK_MIN As Integer = 6  ' Min messages before long break
Const MESSAGES_BEFORE_BREAK_MAX As Integer = 8  ' Max messages before long break
Const RETRY_DELAY As Integer = 5        ' Retry delay after failure (seconds)

' Sheet Names
Const SHEET_DATA As String = "Data"
Const SHEET_DND As String = "DND"
Const SHEET_TEMPLATE As String = "Template"

' Column positions in Data sheet
Const COL_CONTACT As Integer = 1        ' A: Contact No
Const COL_NAME As Integer = 2           ' B: Name
Const COL_FILEID As Integer = 3         ' C: File ID
Const COL_HEADER1 As Integer = 4        ' D: Header1
Const COL_HEADER2 As Integer = 5        ' E: Header2
Const COL_HEADER3 As Integer = 6        ' F: Header3
Const COL_STATUS As Integer = 7         ' G: WhatsApp Status

' ============================================
' AUTO-SETUP: Create Sheet Structure (First Time)
' ============================================
Sub SetupSpreadsheet()
    Dim ws As Worksheet
    Dim response As VbMsgBoxResult
    Dim i As Integer
    
    ' Check if sheets already exist
    Dim sheetsExist As Boolean
    sheetsExist = False
    
    On Error Resume Next
    sheetsExist = Not (ThisWorkbook.Sheets(SHEET_DATA) Is Nothing) And _
                  Not (ThisWorkbook.Sheets(SHEET_DND) Is Nothing) And _
                  Not (ThisWorkbook.Sheets(SHEET_TEMPLATE) Is Nothing)
    On Error GoTo 0
    
    If sheetsExist Then
        response = MsgBox("Sheets already exist. Do you want to recreate them?" & vbCrLf & vbCrLf & _
                         "WARNING: This will delete existing data!", vbQuestion + vbYesNo, "Confirm Setup")
        If response = vbNo Then Exit Sub
        
        ' Delete existing sheets
        Application.DisplayAlerts = False
        On Error Resume Next
        ThisWorkbook.Sheets(SHEET_DATA).Delete
        ThisWorkbook.Sheets(SHEET_DND).Delete
        ThisWorkbook.Sheets(SHEET_TEMPLATE).Delete
        On Error GoTo 0
        Application.DisplayAlerts = True
    End If
    
    ' Create Data Sheet
    Set ws = ThisWorkbook.Sheets.Add(Before:=ThisWorkbook.Sheets(1))
    ws.Name = SHEET_DATA
    
    ' Set Data sheet headers
    With ws
        .Cells(1, 1).Value = "contact no"
        .Cells(1, 2).Value = "name"
        .Cells(1, 3).Value = "fileid"
        .Cells(1, 4).Value = "header1"
        .Cells(1, 5).Value = "header2"
        .Cells(1, 6).Value = "header3"
        .Cells(1, 7).Value = "whatsapp status"
        
        ' Format headers
        With .Range("A1:G1")
            .Font.Bold = True
            .Interior.Color = RGB(200, 220, 255)
            .HorizontalAlignment = xlCenter
        End With
        
        ' Add sample data
        .Cells(2, 1).Value = "9876543210"
        .Cells(2, 2).Value = "Raj Kumar"
        .Cells(2, 3).Value = "F001"
        .Cells(2, 4).Value = "Invoice"
        .Cells(2, 5).Value = "₹500"
        .Cells(2, 6).Value = "10/11/2025"
        
        .Cells(3, 1).Value = "9123456789"
        .Cells(3, 2).Value = "Priya Sharma"
        .Cells(3, 3).Value = "F002"
        .Cells(3, 4).Value = "Payment"
        .Cells(3, 5).Value = "₹1200"
        .Cells(3, 6).Value = "11/11/2025"
        
        ' Auto-fit columns
        .Columns("A:G").AutoFit
    End With
    
    ' Create DND Sheet
    Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(SHEET_DATA))
    ws.Name = SHEET_DND
    
    With ws
        .Cells(1, 1).Value = "contact no"
        .Cells(1, 1).Font.Bold = True
        .Cells(1, 1).Interior.Color = RGB(255, 200, 200)
        .Cells(1, 1).HorizontalAlignment = xlCenter
        
        ' Add sample DND number
        .Cells(2, 1).Value = "9998887777"
        
        .Columns("A:A").AutoFit
    End With
    
    ' Create Template Sheet
    Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(SHEET_DND))
    ws.Name = SHEET_TEMPLATE
    
    With ws
        ' Set template
        .Range("A1").Value = "Hello {{name}}," & vbCrLf & vbCrLf & _
                            "Your {{header1}} of {{header2}} is due on {{header3}}." & vbCrLf & _
                            "Please check file ID {{fileid}}." & vbCrLf & vbCrLf & _
                            "For any queries, contact us." & vbCrLf & vbCrLf & _
                            "Thank you," & vbCrLf & _
                            "Team"
        
        .Range("A1").Font.Bold = True
        .Range("A1").Interior.Color = RGB(255, 255, 200)
        .Range("A1").WrapText = True
        .Range("A1").RowHeight = 150
        .Columns("A:A").ColumnWidth = 80
        
        ' Add instructions
        .Range("A13").Value = "Instructions:"
        .Range("A13").Font.Bold = True
        .Range("A14").Value = "1. Edit the message template in cell A1 above"
        .Range("A15").Value = "2. Use {{placeholders}} to insert dynamic data"
        .Range("A16").Value = "3. Available: {{name}}, {{fileid}}, {{header1}}, {{header2}}, {{header3}}, {{contact}}"
    End With
    
    ' Activate Data sheet
    ThisWorkbook.Sheets(SHEET_DATA).Activate
    
    MsgBox "Spreadsheet setup complete!" & vbCrLf & vbCrLf & _
           "✅ Data sheet created with sample data" & vbCrLf & _
           "✅ DND sheet created" & vbCrLf & _
           "✅ Template sheet created with sample template" & vbCrLf & vbCrLf & _
           "Next steps:" & vbCrLf & _
           "1. Replace sample data in Data sheet" & vbCrLf & _
           "2. Add DND numbers in DND sheet (if any)" & vbCrLf & _
           "3. Customize message in Template sheet" & vbCrLf & _
           "4. Run TestSingleMessage to test" & vbCrLf & _
           "5. Run SendBulkWhatsAppMessages to send all", _
           vbInformation, "Setup Complete"
End Sub

' ============================================
' MAIN FUNCTION - Start Bulk Messaging
' ============================================
Sub SendBulkWhatsAppMessages()
    Dim wsData As Worksheet, wsDND As Worksheet, wsTemplate As Worksheet
    Dim lastRow As Long, currentRow As Long
    Dim messageCount As Integer, breakThreshold As Integer
    Dim contactNo As String, messageText As String, templateText As String
    Dim startTime As Double
    Dim response As VbMsgBoxResult
    
    On Error GoTo ErrorHandler
    
    ' Check if sheets exist, if not offer to create them
    On Error Resume Next
    Set wsData = ThisWorkbook.Sheets(SHEET_DATA)
    Set wsDND = ThisWorkbook.Sheets(SHEET_DND)
    Set wsTemplate = ThisWorkbook.Sheets(SHEET_TEMPLATE)
    On Error GoTo ErrorHandler
    
    If wsData Is Nothing Or wsDND Is Nothing Or wsTemplate Is Nothing Then
        response = MsgBox("Required sheets not found!" & vbCrLf & vbCrLf & _
                         "Do you want to create the sheet structure now?", _
                         vbQuestion + vbYesNo, "Setup Required")
        If response = vbYes Then
            SetupSpreadsheet
            MsgBox "Please add your contact data and run again.", vbInformation, "Setup Complete"
            Exit Sub
        Else
            MsgBox "Cannot proceed without required sheets (Data, DND, Template)", vbCritical, "Error"
            Exit Sub
        End If
    End If
    
    ' Get template
    templateText = wsTemplate.Range("A1").Value
    If Len(templateText) = 0 Then
        MsgBox "Template is empty! Please add message template in Template sheet, Cell A1.", vbCritical
        Exit Sub
    End If
    
    ' Confirmation
    Dim totalContacts As Long
    lastRow = wsData.Cells(wsData.Rows.Count, COL_CONTACT).End(xlUp).Row
    totalContacts = lastRow - 1 ' Exclude header
    
    If totalContacts <= 0 Then
        MsgBox "No contacts found in Data sheet!", vbExclamation
        Exit Sub
    End If
    
    Dim response As VbMsgBoxResult
    response = MsgBox("Ready to send messages to " & totalContacts & " contacts." & vbCrLf & vbCrLf & _
                      "Continue?", vbQuestion + vbYesNo, "Confirm Bulk Send")
    If response = vbNo Then Exit Sub
    
    ' Initialize counters
    messageCount = 0
    breakThreshold = GetRandomNumber(MESSAGES_BEFORE_BREAK_MIN, MESSAGES_BEFORE_BREAK_MAX)
    startTime = Timer
    
    ' Show progress form
    Application.ScreenUpdating = False
    Application.StatusBar = "Starting bulk message send..."
    
    ' Loop through contacts
    For currentRow = 2 To lastRow
        contactNo = Trim(wsData.Cells(currentRow, COL_CONTACT).Value)
        
        ' Skip if empty
        If Len(contactNo) = 0 Then
            GoTo NextContact
        End If
        
        ' Skip if already sent
        If wsData.Cells(currentRow, COL_STATUS).Value = "Sent ✅" Then
            GoTo NextContact
        End If
        
        ' Check DND list
        If IsNumberInDND(contactNo, wsDND) Then
            wsData.Cells(currentRow, COL_STATUS).Value = "DND 🚫"
            wsData.Cells(currentRow, COL_STATUS).Interior.Color = RGB(255, 200, 200)
            GoTo NextContact
        End If
        
        ' Prepare message
        messageText = ReplaceTemplatePlaceholders(templateText, wsData, currentRow)
        
        ' Update status
        wsData.Cells(currentRow, COL_STATUS).Value = "Sending..."
        wsData.Cells(currentRow, COL_STATUS).Interior.Color = RGB(255, 255, 200)
        Application.StatusBar = "Sending to " & contactNo & " (" & (currentRow - 1) & "/" & totalContacts & ")..."
        DoEvents
        
        ' Send message
        Dim sendResult As Boolean
        sendResult = SendWhatsAppMessage(contactNo, messageText, wsData, currentRow)
        
        If sendResult Then
            messageCount = messageCount + 1
            
            ' Random delay between messages
            Dim randomDelay As Integer
            randomDelay = GetRandomNumber(MIN_DELAY, MAX_DELAY)
            Application.StatusBar = "Message sent! Waiting " & randomDelay & " seconds..."
            Sleep randomDelay
            
            ' Long break after threshold
            If messageCount >= breakThreshold Then
                Dim longBreak As Integer
                longBreak = GetRandomNumber(LONG_BREAK_MIN, LONG_BREAK_MAX)
                Application.StatusBar = "Taking long break (" & longBreak & " seconds) after " & messageCount & " messages..."
                Sleep longBreak
                
                ' Reset counter and set new threshold
                messageCount = 0
                breakThreshold = GetRandomNumber(MESSAGES_BEFORE_BREAK_MIN, MESSAGES_BEFORE_BREAK_MAX)
            End If
        Else
            ' Retry once after failure
            Application.StatusBar = "Retry in " & RETRY_DELAY & " seconds..."
            Sleep RETRY_DELAY
            
            sendResult = SendWhatsAppMessage(contactNo, messageText, wsData, currentRow)
        End If
        
NextContact:
    Next currentRow
    
    ' Complete
    Dim elapsedTime As Long
    elapsedTime = Timer - startTime
    Application.ScreenUpdating = True
    Application.StatusBar = False
    
    MsgBox "Bulk messaging complete!" & vbCrLf & vbCrLf & _
           "Total contacts: " & totalContacts & vbCrLf & _
           "Time elapsed: " & Format(elapsedTime / 60, "0.0") & " minutes", _
           vbInformation, "Complete"
    Exit Sub
    
ErrorHandler:
    Application.ScreenUpdating = True
    Application.StatusBar = False
    MsgBox "Error: " & Err.Description & vbCrLf & "Error Number: " & Err.Number, vbCritical
End Sub

' ============================================
' SEND WHATSAPP MESSAGE VIA API
' ============================================
Function SendWhatsAppMessage(ByVal phoneNumber As String, ByVal messageText As String, _
                             ByRef ws As Worksheet, ByVal rowNum As Long) As Boolean
    Dim http As Object
    Dim url As String
    Dim jsonBody As String
    Dim responseText As String
    
    On Error GoTo ErrorHandler
    
    ' Format phone number (ensure it has country code)
    ' Remove spaces and special characters
    phoneNumber = Replace(phoneNumber, " ", "")
    phoneNumber = Replace(phoneNumber, "-", "")
    phoneNumber = Replace(phoneNumber, "+", "")
    
    ' Add country code if not present
    If Left(phoneNumber, 2) <> "91" And Len(phoneNumber) = 10 Then
        phoneNumber = "91" & phoneNumber
    End If
    
    ' Create HTTP request
    Set http = CreateObject("MSXML2.XMLHTTP")
    url = API_BASE_URL & API_ENDPOINT
    
    ' Prepare JSON body
    jsonBody = "{" & _
               """to"":""" & phoneNumber & """," & _
               """message"":""" & EscapeJSON(messageText) & """" & _
               "}"
    
    ' Send request
    http.Open "POST", url, False
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "phone-id", PHONE_ID
    http.setRequestHeader "token", API_TOKEN
    
    ' Set timeout (30 seconds)
    http.setTimeouts 30000, 30000, 30000, 30000
    
    http.send jsonBody
    responseText = http.responseText
    
    ' Check response
    If http.Status = 200 Or InStr(responseText, """success"":true") > 0 Then
        ws.Cells(rowNum, COL_STATUS).Value = "Sent ✅"
        ws.Cells(rowNum, COL_STATUS).Interior.Color = RGB(200, 255, 200)
        SendWhatsAppMessage = True
    Else
        ws.Cells(rowNum, COL_STATUS).Value = "Failed ❌"
        ws.Cells(rowNum, COL_STATUS).Interior.Color = RGB(255, 200, 200)
        ws.Cells(rowNum, COL_STATUS).AddComment "Error: " & responseText
        SendWhatsAppMessage = False
    End If
    
    Set http = Nothing
    Exit Function
    
ErrorHandler:
    ws.Cells(rowNum, COL_STATUS).Value = "Error ❌"
    ws.Cells(rowNum, COL_STATUS).Interior.Color = RGB(255, 200, 200)
    ws.Cells(rowNum, COL_STATUS).AddComment "VBA Error: " & Err.Description
    SendWhatsAppMessage = False
End Function

' ============================================
' CHECK IF NUMBER IN DND LIST
' ============================================
Function IsNumberInDND(ByVal phoneNumber As String, ByRef wsDND As Worksheet) As Boolean
    Dim lastRow As Long, i As Long
    Dim dndNumber As String
    
    IsNumberInDND = False
    phoneNumber = Trim(Replace(phoneNumber, " ", ""))
    
    lastRow = wsDND.Cells(wsDND.Rows.Count, 1).End(xlUp).Row
    
    For i = 2 To lastRow ' Start from row 2 (skip header)
        dndNumber = Trim(Replace(wsDND.Cells(i, 1).Value, " ", ""))
        If Len(dndNumber) > 0 And (dndNumber = phoneNumber Or _
           Right(phoneNumber, 10) = Right(dndNumber, 10)) Then
            IsNumberInDND = True
            Exit Function
        End If
    Next i
End Function

' ============================================
' REPLACE TEMPLATE PLACEHOLDERS
' ============================================
Function ReplaceTemplatePlaceholders(ByVal template As String, ByRef ws As Worksheet, _
                                    ByVal rowNum As Long) As String
    Dim result As String
    result = template
    
    ' Replace placeholders with actual values
    result = Replace(result, "{{name}}", ws.Cells(rowNum, COL_NAME).Value)
    result = Replace(result, "{{fileid}}", ws.Cells(rowNum, COL_FILEID).Value)
    result = Replace(result, "{{header1}}", ws.Cells(rowNum, COL_HEADER1).Value)
    result = Replace(result, "{{header2}}", ws.Cells(rowNum, COL_HEADER2).Value)
    result = Replace(result, "{{header3}}", ws.Cells(rowNum, COL_HEADER3).Value)
    result = Replace(result, "{{contact}}", ws.Cells(rowNum, COL_CONTACT).Value)
    
    ReplaceTemplatePlaceholders = result
End Function

' ============================================
' ESCAPE JSON SPECIAL CHARACTERS
' ============================================
Function EscapeJSON(ByVal text As String) As String
    text = Replace(text, "\", "\\")
    text = Replace(text, """", "\""")
    text = Replace(text, vbCrLf, "\n")
    text = Replace(text, vbCr, "\n")
    text = Replace(text, vbLf, "\n")
    text = Replace(text, vbTab, "\t")
    EscapeJSON = text
End Function

' ============================================
' GENERATE RANDOM NUMBER
' ============================================
Function GetRandomNumber(ByVal minVal As Integer, ByVal maxVal As Integer) As Integer
    Randomize
    GetRandomNumber = Int((maxVal - minVal + 1) * Rnd + minVal)
End Function

' ============================================
' SLEEP FUNCTION (in seconds)
' ============================================
Sub Sleep(ByVal seconds As Integer)
    Dim endTime As Double
    endTime = Timer + seconds
    Do While Timer < endTime
        DoEvents
    Loop
End Sub

' ============================================
' UTILITY: Clear All Status
' ============================================
Sub ClearAllStatus()
    Dim ws As Worksheet
    Dim lastRow As Long, i As Long
    
    Set ws = ThisWorkbook.Sheets(SHEET_DATA)
    lastRow = ws.Cells(ws.Rows.Count, COL_CONTACT).End(xlUp).Row
    
    If MsgBox("Clear all status for " & (lastRow - 1) & " contacts?", vbQuestion + vbYesNo) = vbNo Then
        Exit Sub
    End If
    
    For i = 2 To lastRow
        ws.Cells(i, COL_STATUS).Value = ""
        ws.Cells(i, COL_STATUS).Interior.ColorIndex = xlNone
        If Not ws.Cells(i, COL_STATUS).Comment Is Nothing Then
            ws.Cells(i, COL_STATUS).Comment.Delete
        End If
    Next i
    
    MsgBox "Status cleared!", vbInformation
End Sub

' ============================================
' UTILITY: Test Single Message
' ============================================
Sub TestSingleMessage()
    Dim ws As Worksheet, wsTemplate As Worksheet
    Dim contactNo As String, messageText As String, templateText As String
    Dim testRow As Long
    Dim response As VbMsgBoxResult
    
    ' Check if sheets exist
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets(SHEET_DATA)
    Set wsTemplate = ThisWorkbook.Sheets(SHEET_TEMPLATE)
    On Error GoTo 0
    
    If ws Is Nothing Or wsTemplate Is Nothing Then
        response = MsgBox("Required sheets not found!" & vbCrLf & vbCrLf & _
                         "Do you want to create the sheet structure now?", _
                         vbQuestion + vbYesNo, "Setup Required")
        If response = vbYes Then
            SetupSpreadsheet
            MsgBox "Please customize the sample data and run again.", vbInformation, "Setup Complete"
        End If
        Exit Sub
    End If
    
    ' Get first contact
    testRow = 2
    If ws.Cells(testRow, COL_CONTACT).Value = "" Then
        MsgBox "No contacts in Data sheet!", vbExclamation
        Exit Sub
    End If
    
    contactNo = ws.Cells(testRow, COL_CONTACT).Value
    templateText = wsTemplate.Range("A1").Value
    messageText = ReplaceTemplatePlaceholders(templateText, ws, testRow)
    
    ' Show preview
    If MsgBox("Test message to: " & contactNo & vbCrLf & vbCrLf & _
              "Message:" & vbCrLf & messageText & vbCrLf & vbCrLf & _
              "Send test message?", vbQuestion + vbYesNo) = vbNo Then
        Exit Sub
    End If
    
    ' Send
    Application.StatusBar = "Sending test message..."
    Dim result As Boolean
    result = SendWhatsAppMessage(contactNo, messageText, ws, testRow)
    Application.StatusBar = False
    
    If result Then
        MsgBox "Test message sent successfully!", vbInformation
    Else
        MsgBox "Test message failed. Check status column.", vbExclamation
    End If
End Sub

' ============================================
' UTILITY: Count Statistics
' ============================================
Sub ShowStatistics()
    Dim ws As Worksheet
    Dim lastRow As Long, i As Long
    Dim totalContacts As Long, sentCount As Long, failedCount As Long
    Dim pendingCount As Long, dndCount As Long
    
    Set ws = ThisWorkbook.Sheets(SHEET_DATA)
    lastRow = ws.Cells(ws.Rows.Count, COL_CONTACT).End(xlUp).Row
    
    For i = 2 To lastRow
        If ws.Cells(i, COL_CONTACT).Value <> "" Then
            totalContacts = totalContacts + 1
            
            Select Case ws.Cells(i, COL_STATUS).Value
                Case "Sent ✅"
                    sentCount = sentCount + 1
                Case "Failed ❌", "Error ❌"
                    failedCount = failedCount + 1
                Case "DND 🚫"
                    dndCount = dndCount + 1
                Case Else
                    pendingCount = pendingCount + 1
            End Select
        End If
    Next i
    
    MsgBox "📊 Campaign Statistics" & vbCrLf & vbCrLf & _
           "Total Contacts: " & totalContacts & vbCrLf & _
           "Sent: " & sentCount & " ✅" & vbCrLf & _
           "Failed: " & failedCount & " ❌" & vbCrLf & _
           "DND: " & dndCount & " 🚫" & vbCrLf & _
           "Pending: " & pendingCount & vbCrLf & vbCrLf & _
           "Success Rate: " & Format(sentCount / IIf(totalContacts - dndCount = 0, 1, totalContacts - dndCount), "0.0%"), _
           vbInformation, "Statistics"
End Sub
