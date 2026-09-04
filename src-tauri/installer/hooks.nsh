; DISTRIBUTION.md §2 (WIN-T2…T5) / INST-004: aplica solo las tareas que el
; usuario marcó en la página "Tareas adicionales" (ver
; installer/mdviedit-installer.nsi, PageAdditionalTasks) y revierte
; exactamente eso al desinstalar — nunca más de lo que el propio instalador
; creó, sin tocar HKLM (instalación siempre currentUser, INST-011).
;
; WIN-T2/T3 se registran sobre SystemFileAssociations / Directory
; directamente (no bajo el ProgId MDviedit.md) para que sean independientes
; de si el usuario marcó WIN-T4 (asociación por defecto) o no — igual que el
; "Open with Code" del instalador de VS Code (INST-002), que no depende de
; que Code sea el editor predeterminado.
;
; Qué tareas se aplicaron realmente se persiste bajo ${MANUPRODUCTKEY}
; (Task*) porque el estado de los checkboxes de esta ejecución no sobrevive
; al proceso separado del desinstalador; NSIS_HOOK_PREUNINSTALL lee esas
; marcas — no el estado de los checkboxes — para decidir qué revertir.

!macro MdvWriteFileContextEntry ext
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.${ext}\shell\MDviedit" "" "$(MDV_TASK_FILE_CONTEXT)"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.${ext}\shell\MDviedit" "Icon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.${ext}\shell\MDviedit\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
!macroend

!macro MdvDeleteFileContextEntry ext
  DeleteRegKey SHCTX "Software\Classes\SystemFileAssociations\.${ext}\shell\MDviedit"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; WIN-T4 (default ☑, PD-24): registra MDviedit como editor de
  ; .md/.markdown/.txt sin forzarlo como predeterminado (rank Alternate ya
  ; lo maneja Explorer al mostrarlo en "Abrir con").
  ${If} $StateFileAssoc = 1
    !insertmacro APP_ASSOCIATE "md" "MDviedit.md" "$(MDV_FILE_DESC_MD)" "$INSTDIR\${MAINBINARYNAME}.exe,0" "$(MDV_OPEN_WITH)" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
    !insertmacro APP_ASSOCIATE "markdown" "MDviedit.markdown" "$(MDV_FILE_DESC_MD)" "$INSTDIR\${MAINBINARYNAME}.exe,0" "$(MDV_OPEN_WITH)" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
    !insertmacro APP_ASSOCIATE "txt" "MDviedit.txt" "$(MDV_FILE_DESC_TXT)" "$INSTDIR\${MAINBINARYNAME}.exe,0" "$(MDV_OPEN_WITH)" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
    !insertmacro UPDATEFILEASSOC
  ${EndIf}

  ; WIN-T2 (default ☐): "Abrir con MDviedit" en archivos .md/.markdown/.txt.
  ${If} $StateFileContext = 1
    !insertmacro MdvWriteFileContextEntry "md"
    !insertmacro MdvWriteFileContextEntry "markdown"
    !insertmacro MdvWriteFileContextEntry "txt"
  ${EndIf}

  ; WIN-T3 (default ☐): "Abrir con MDviedit" en carpetas (clic derecho sobre
  ; la carpeta y en el fondo de una carpeta abierta). La app expande el
  ; primer nivel (maxFolderOpen) al recibir la ruta — ver resolve_cli_paths.
  ${If} $StateFolderContext = 1
    WriteRegStr SHCTX "Software\Classes\Directory\shell\MDviedit" "" "$(MDV_TASK_FOLDER_CONTEXT)"
    WriteRegStr SHCTX "Software\Classes\Directory\shell\MDviedit" "Icon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
    WriteRegStr SHCTX "Software\Classes\Directory\shell\MDviedit\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%V$\""
    WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\MDviedit" "" "$(MDV_TASK_FOLDER_CONTEXT)"
    WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\MDviedit" "Icon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
    WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\MDviedit\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%V$\""
  ${EndIf}

  ; WIN-T5 (default ☐): PATH per-user (HKCU\Environment, nunca HKLM).
  ${If} $StateAddPath = 1
    !insertmacro MdvAddInstDirToPath
  ${EndIf}

  ; Marca qué se aplicó de verdad, para revertir exactamente eso al
  ; desinstalar (el desinstalador es un proceso aparte, sin los $State*).
  WriteRegDWORD SHCTX "${MANUPRODUCTKEY}" "TaskFileAssoc" "$StateFileAssoc"
  WriteRegDWORD SHCTX "${MANUPRODUCTKEY}" "TaskFileContext" "$StateFileContext"
  WriteRegDWORD SHCTX "${MANUPRODUCTKEY}" "TaskFolderContext" "$StateFolderContext"
  WriteRegDWORD SHCTX "${MANUPRODUCTKEY}" "TaskAddPath" "$StateAddPath"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ReadRegDWORD $R5 SHCTX "${MANUPRODUCTKEY}" "TaskFileAssoc"
  ${If} $R5 = 1
    !insertmacro APP_UNASSOCIATE "md" "MDviedit.md"
    !insertmacro APP_UNASSOCIATE "markdown" "MDviedit.markdown"
    !insertmacro APP_UNASSOCIATE "txt" "MDviedit.txt"
    !insertmacro UPDATEFILEASSOC
  ${EndIf}

  ReadRegDWORD $R5 SHCTX "${MANUPRODUCTKEY}" "TaskFileContext"
  ${If} $R5 = 1
    !insertmacro MdvDeleteFileContextEntry "md"
    !insertmacro MdvDeleteFileContextEntry "markdown"
    !insertmacro MdvDeleteFileContextEntry "txt"
  ${EndIf}

  ReadRegDWORD $R5 SHCTX "${MANUPRODUCTKEY}" "TaskFolderContext"
  ${If} $R5 = 1
    DeleteRegKey SHCTX "Software\Classes\Directory\shell\MDviedit"
    DeleteRegKey SHCTX "Software\Classes\Directory\Background\shell\MDviedit"
  ${EndIf}

  ReadRegDWORD $R5 SHCTX "${MANUPRODUCTKEY}" "TaskAddPath"
  ${If} $R5 = 1
    !insertmacro MdvRemoveInstDirFromPath
  ${EndIf}

  DeleteRegValue SHCTX "${MANUPRODUCTKEY}" "TaskFileAssoc"
  DeleteRegValue SHCTX "${MANUPRODUCTKEY}" "TaskFileContext"
  DeleteRegValue SHCTX "${MANUPRODUCTKEY}" "TaskFolderContext"
  DeleteRegValue SHCTX "${MANUPRODUCTKEY}" "TaskAddPath"
!macroend
