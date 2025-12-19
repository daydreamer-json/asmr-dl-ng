#define MyAppName "asmr-dl-ng"
#define MyAppVersion "1.2.2"
#define MyAppPublisher "daydreamer-json"
#define MyAppURL "https://github.com/daydreamer-json/asmr-dl-ng"
#define MyAppExeName "asmr-dl-ng.exe"

[Setup]
AppId={{B0B8B114-AE98-4165-BFC7-E029C1DB80D4}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
AppCopyright=(C) {#MyAppPublisher} and contributors
DefaultDirName={autopf}\{#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
; "ArchitecturesAllowed=x64compatible" specifies that Setup cannot run
; on anything but x64 and Windows 11 on Arm.
ArchitecturesAllowed=x64compatible
; "ArchitecturesInstallIn64BitMode=x64compatible" requests that the
; install be done in "64-bit mode" on x64 or Windows 11 on Arm,
; meaning it should use the native 64-bit Program Files directory and
; the 64-bit view of the registry.
ArchitecturesInstallIn64BitMode=x64compatible
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=D:\Applications\GitHub\Repository\asmr-dl-ng\LICENSE
; Remove the following line to run in administrative install mode (install for all users).
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=D:\Applications\GitHub\Repository\asmr-dl-ng\build
OutputBaseFilename=asmr-dl-ng_win_x64_{#MyAppVersion}_setup
SolidCompression=yes
WizardStyle=modern dynamic windows11
ChangesEnvironment=true

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "armenian"; MessagesFile: "compiler:Languages\Armenian.isl"
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "bulgarian"; MessagesFile: "compiler:Languages\Bulgarian.isl"
Name: "catalan"; MessagesFile: "compiler:Languages\Catalan.isl"
Name: "corsican"; MessagesFile: "compiler:Languages\Corsican.isl"
Name: "czech"; MessagesFile: "compiler:Languages\Czech.isl"
Name: "danish"; MessagesFile: "compiler:Languages\Danish.isl"
Name: "dutch"; MessagesFile: "compiler:Languages\Dutch.isl"
Name: "finnish"; MessagesFile: "compiler:Languages\Finnish.isl"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "hebrew"; MessagesFile: "compiler:Languages\Hebrew.isl"
Name: "hungarian"; MessagesFile: "compiler:Languages\Hungarian.isl"
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "norwegian"; MessagesFile: "compiler:Languages\Norwegian.isl"
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"
Name: "portuguese"; MessagesFile: "compiler:Languages\Portuguese.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "slovak"; MessagesFile: "compiler:Languages\Slovak.isl"
Name: "slovenian"; MessagesFile: "compiler:Languages\Slovenian.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "swedish"; MessagesFile: "compiler:Languages\Swedish.isl"
Name: "tamil"; MessagesFile: "compiler:Languages\Tamil.isl"
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"
Name: "ukrainian"; MessagesFile: "compiler:Languages\Ukrainian.isl"

[Tasks]
Name: "AddToPath"; Description: "Add app directory to PATH environment variable"; Flags: checkedonce

[Files]
Source: "D:\Applications\GitHub\Repository\asmr-dl-ng\build\asmr-dl-ng\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "D:\Applications\GitHub\Repository\asmr-dl-ng\build\asmr-dl-ng\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; [Icons]
; Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"

[Registry]
; Add the application's directory to the user's PATH
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; Check: (not IsAdminInstallMode) and WizardIsTaskSelected('AddToPath') and NeedsAddPath('{app}')
; Add the application's directory to the system's PATH if installing for all users
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control\Session Manager\Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; Check: IsAdminInstallMode and WizardIsTaskSelected('AddToPath') and NeedsAddPath('{app}')

[Code]
function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
  ParamExpanded: string;
begin
  ParamExpanded := ExpandConstant(Param);
  
  if not RegQueryStringValue(HKEY_LOCAL_MACHINE,
    'SYSTEM\CurrentControlSet\Control\Session Manager\Environment',
    'Path', OrigPath)
  then begin
    Result := True;
    exit;
  end;
  
  Result := Pos(';' + UpperCase(ParamExpanded) + ';', ';' + UpperCase(OrigPath) + ';') = 0;
  
  if Result = True then
    Result := Pos(';' + UpperCase(ParamExpanded) + '\;', ';' + UpperCase(OrigPath) + ';') = 0;
end;

procedure RemovePath(RootKey: Integer; SubKey, ValueName, PathToRemove: string);
var
  Paths: string;
  P: Integer;
begin
  if not RegQueryStringValue(RootKey, SubKey, ValueName, Paths) then
    Exit;

  P := Pos(';' + UpperCase(PathToRemove) + ';', ';' + UpperCase(Paths) + ';');
  if P = 0 then
  begin
    P := Pos(';' + UpperCase(PathToRemove) + '\;', ';' + UpperCase(Paths) + ';');
  end;

  if P > 0 then
  begin
    StringChangeEx(Paths, ';' + PathToRemove + ';', ';', True);
    StringChangeEx(Paths, PathToRemove + ';', '', True);
    StringChangeEx(Paths, ';' + PathToRemove, '', True);
    RegWriteExpandStringValue(RootKey, SubKey, ValueName, Paths);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  AppPath: string;
begin
  if CurUninstallStep = usUninstall then
  begin
    AppPath := ExpandConstant('{app}');
    
    if IsAdminInstallMode then
    begin
      RemovePath(HKEY_LOCAL_MACHINE, 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment', 'Path', AppPath);
    end
    else
    begin
      RemovePath(HKEY_CURRENT_USER, 'Environment', 'Path', AppPath);
    end;
  end;
end;