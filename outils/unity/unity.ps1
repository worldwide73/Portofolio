<#
.SYNOPSIS
  Portal Rush (Unity) : installe, configure, teste et construit le projet Unity sans ouvrir l'éditeur.

.DESCRIPTION
  Lance Unity.exe en mode batch (sans fenêtre, sans clic), une étape à la fois, sur le projet
  unity\PortalRush du dépôt, avec les points d'entrée du contrat (docs/UNITY_ARCHITECTURE.md, §6.2) :

    -Installer   PortalRush.Installation.Installateur.InstallerEnBatch
                 installe les paquets (URP, Input System, Test Framework) et ajoute PORTALRUSH_PAQUETS
    -Configurer  PortalRush.Editeur.Batch.Configurer
                 URP, niveaux de qualité, réglages Web, matériaux, scène
    -Tests       -runTests -testPlatform EditMode
                 rejoue les parties de référence (même vérification que outils/unity/coeur-tests)
    -Construire  PortalRush.Editeur.Batch.Construire
                 build Web vers public\rush-unity\ et son manifeste portal-rush.json
    -Tout        les quatre, dans cet ordre ; on s'arrête à la première étape qui échoue

  Chaque étape est un lancement séparé de Unity : l'installation des paquets change la compilation,
  et c'est le lancement suivant qui compile les assemblages gardés par PORTALRUSH_PAQUETS.

  Ce script ne fait QUE lancer Unity et lire ses journaux. Il ne publie rien, ne déploie rien,
  ne lance aucune commande git (ni commit, ni push) et ne supprime aucun fichier.

  Journaux et résultats : unity\PortalRush\Logs\batch\ (dossier ignoré par git).

  Choix des arguments (sources dans docs/UNITY_MIGRATION.md, section « Ligne de commande ») :
    - pas de -quit : avec -runTests, Unity quitterait avant la fin des tests, et avec du code
      asynchrone (installation des paquets) il peut se bloquer. Les méthodes du contrat terminent
      elles-mêmes par EditorApplication.Exit(0 ou 1) ; le Test Framework ferme Unity à la fin des tests ;
    - -nographics seulement pour Installer et Tests : la documentation ne garantit rien pour la
      compilation des shaders et le build Web sans carte graphique ; on ne s'en sert donc pas pour
      Configurer et Construire ;
    - -buildTarget WebGL à chaque lancement (nom de BuildTarget.WebGL ; la documentation cite aussi
      « webgl ») : le projet est importé directement pour le Web, sans changement de plateforme (long)
      entre deux étapes.

.PARAMETER Unity
  Chemin complet de Unity.exe. Sinon : variable d'environnement UNITY_EXE ; sinon la version 6000.3
  la plus récente installée par Unity Hub (C:\Program Files\Unity\Hub\Editor\6000.3.*\Editor\Unity.exe).

.PARAMETER Projet
  Dossier du projet Unity. Par défaut : unity\PortalRush, à côté de ce script (..\..\unity\PortalRush).

.PARAMETER DelaiMinutes
  Durée maximale d'une étape (par défaut 120 min ; la première importation et le premier build Web
  peuvent être longs). Au-delà, Unity est arrêté et l'étape est comptée en échec.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File outils\unity\unity.ps1 -Tout

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File outils\unity\unity.ps1 -Tests -Unity "D:\Unity\6000.3.26f1\Editor\Unity.exe"

.NOTES
  Compatible Windows PowerShell 5.1 et PowerShell 7. Fichier enregistré en UTF-8 avec BOM (sinon
  Windows PowerShell 5.1 lit mal les accents).
  Codes de sortie : 0 tout va bien ; celui de Unity pour l'étape en échec (1 erreur, 2 tests échoués,
  3 erreur d'exécution des tests, 4 plateforme de test introuvable) ; 9 Unity introuvable ;
  10 projet déjà ouvert dans l'éditeur ; 11 projet introuvable ; 124 délai dépassé.
#>
[CmdletBinding()]
param(
  [string]$Unity,
  [string]$Projet,
  [switch]$Installer,
  [switch]$Configurer,
  [switch]$Tests,
  [switch]$Construire,
  [switch]$Tout,
  [ValidateRange(1, 1440)]
  [int]$DelaiMinutes = 120
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

# ---------------------------------------------------------------------------------------------------
# Petits outils d'affichage
# ---------------------------------------------------------------------------------------------------
function Dire([string]$Texte, [string]$Couleur = 'Gray') { Write-Host $Texte -ForegroundColor $Couleur }
function Titre([string]$Texte) { Write-Host ''; Write-Host ('=== ' + $Texte + ' ===') -ForegroundColor Cyan }
function Bon([string]$Texte) { Dire ('  OK  ' + $Texte) 'Green' }
function Alerte([string]$Texte) { Dire ('  !!  ' + $Texte) 'Yellow' }
function Grave([string]$Texte) { Dire ('  XX  ' + $Texte) 'Red' }

# Entoure un argument de guillemets s'il contient un espace (chemins « Program Files », « Mes documents », etc.).
function Citer([string]$Argument) {
  if ($Argument -eq '') { return '""' }
  if ($Argument -match '[\s"]') { return '"' + ($Argument -replace '"', '\"') + '"' }
  return $Argument
}

# ---------------------------------------------------------------------------------------------------
# 1. Trouver Unity.exe
# ---------------------------------------------------------------------------------------------------
# Ordre des versions 6000.3 : numéro de correctif, puis type (a alpha, b bêta, f finale, p correctif),
# puis numéro de compilation. Exemple : 6000.3.26f1 passe avant 6000.3.9f1.
function Cle-Version([string]$Nom) {
  if ($Nom -notmatch '^6000\.3\.(\d+)([abfpx])(\d+)') { return -1 }
  $rang = 0
  switch ($Matches[2]) { 'a' { $rang = 0 } 'b' { $rang = 1 } 'x' { $rang = 1 } 'f' { $rang = 2 } 'p' { $rang = 3 } }
  return ([int]$Matches[1]) * 10000 + $rang * 1000 + [int]$Matches[3]
}

function Trouver-Unity([string]$Chemin) {
  if ($Chemin) {
    if (Test-Path -LiteralPath $Chemin -PathType Leaf) { return (Resolve-Path -LiteralPath $Chemin).Path }
    throw "Unity.exe introuvable au chemin donné par -Unity : $Chemin"
  }
  if ($env:UNITY_EXE) {
    if (Test-Path -LiteralPath $env:UNITY_EXE -PathType Leaf) { return (Resolve-Path -LiteralPath $env:UNITY_EXE).Path }
    throw "La variable d'environnement UNITY_EXE désigne un fichier absent : $env:UNITY_EXE"
  }

  # Les dossiers où Unity Hub range ses éditeurs.
  $racines = @()
  $programmes = $env:ProgramFiles
  if (-not $programmes) { $programmes = 'C:\Program Files' }
  $racines += [System.IO.Path]::Combine($programmes, 'Unity', 'Hub', 'Editor')
  # Si l'emplacement d'installation a été changé dans Unity Hub (Préférences > Installs), Hub le note
  # dans %APPDATA%\UnityHub\secondaryInstallPath.json (fichier relevé sur des installations courantes,
  # non documenté : s'il manque, on l'ignore).
  if ($env:APPDATA) {
    $fichierHub = Join-Path (Join-Path $env:APPDATA 'UnityHub') 'secondaryInstallPath.json'
    if (Test-Path -LiteralPath $fichierHub -PathType Leaf) {
      try {
        $autre = Get-Content -LiteralPath $fichierHub -Raw | ConvertFrom-Json
        if ($autre -is [string] -and $autre.Trim() -ne '') { $racines += $autre.Trim() }
      } catch { }
    }
  }

  $trouves = @()
  foreach ($racine in $racines) {
    $existe = $false
    try { $existe = Test-Path -LiteralPath $racine -PathType Container } catch { $existe = $false }   # lecteur absent
    if (-not $existe) { continue }
    foreach ($dossier in (Get-ChildItem -LiteralPath $racine -Directory -Filter '6000.3.*')) {
      $exe = Join-Path (Join-Path $dossier.FullName 'Editor') 'Unity.exe'
      if (Test-Path -LiteralPath $exe -PathType Leaf) {
        $trouves += [pscustomobject]@{ Version = $dossier.Name; Cle = (Cle-Version $dossier.Name); Exe = $exe }
      }
    }
  }
  if ($trouves.Count -eq 0) { return $null }
  $meilleur = $trouves | Sort-Object -Property Cle -Descending | Select-Object -First 1
  return $meilleur.Exe
}

# ---------------------------------------------------------------------------------------------------
# 2. Le projet est-il ouvert dans l'éditeur ? (le mode batch ne peut pas ouvrir un projet déjà ouvert)
# ---------------------------------------------------------------------------------------------------
# Unity crée Temp\UnityLockfile et le garde ouvert tant que l'éditeur tient le projet. S'il existe mais
# que l'on peut l'ouvrir en exclusivité, c'est un reste d'une session interrompue : personne ne le tient.
function Projet-Ouvert([string]$Dossier) {
  $verrou = Join-Path (Join-Path $Dossier 'Temp') 'UnityLockfile'
  if (Test-Path -LiteralPath $verrou -PathType Leaf) {
    try {
      $flux = [System.IO.File]::Open($verrou, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
      $flux.Close()
      Alerte 'Temp\UnityLockfile existe mais aucun Unity ne le tient (session interrompue) : on continue.'
    } catch {
      return $true
    }
  }
  # Deuxième indice (Windows) : un Unity.exe lancé sur ce projet.
  if ($env:OS -eq 'Windows_NT') {
    try {
      $cible = $Dossier.Replace('/', '\').TrimEnd('\')
      foreach ($p in (Get-CimInstance -ClassName Win32_Process -Filter "Name = 'Unity.exe'" -ErrorAction Stop)) {
        $ligne = [string]$p.CommandLine
        if ($ligne -and $ligne.Replace('/', '\').IndexOf($cible, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
      }
    } catch { }
  }
  return $false
}

# ---------------------------------------------------------------------------------------------------
# 3. Lire les journaux
# ---------------------------------------------------------------------------------------------------
function Derniere-Ligne([string]$Journal) {
  if (-not (Test-Path -LiteralPath $Journal -PathType Leaf)) { return '(journal pas encore créé)' }
  try {
    $lignes = @(Get-Content -LiteralPath $Journal -Tail 30 -ErrorAction Stop | Where-Object { $_.Trim() -ne '' })
    if ($lignes.Count -eq 0) { return '' }
    $l = $lignes[$lignes.Count - 1].Trim()
    if ($l.Length -gt 110) { $l = $l.Substring(0, 107) + '...' }
    return $l
  } catch { return '(journal en cours d''écriture)' }
}

# Les lignes du journal qui correspondent à un motif (sans doublon, les dernières d'abord gardées).
function Lignes([string]$Journal, [string]$Motif, [int]$Max = 15) {
  if (-not (Test-Path -LiteralPath $Journal -PathType Leaf)) { return @() }
  $vues = @{}
  $liste = @()
  foreach ($m in (Select-String -LiteralPath $Journal -Pattern $Motif -ErrorAction SilentlyContinue)) {
    $t = $m.Line.Trim()
    if (-not $vues.ContainsKey($t)) { $vues[$t] = $true; $liste += $t }
  }
  if ($liste.Count -gt $Max) { $liste = $liste[($liste.Count - $Max)..($liste.Count - 1)] }
  return $liste
}

function Resume-Journal([string]$Journal) {
  if (-not (Test-Path -LiteralPath $Journal -PathType Leaf)) { Grave "Pas de journal : $Journal (Unity n'a pas démarré ?)"; return }

  $erreursCS = @(Lignes $Journal 'error CS\d{4}' 15)
  if ($erreursCS.Count -gt 0) {
    Grave ("Erreurs de compilation C# (" + $erreursCS.Count + ", les dernières) :")
    foreach ($e in $erreursCS) { Dire ('      ' + $e) 'Red' }
  }

  # Causes connues, expliquées simplement.
  if (@(Lignes $Journal 'another Unity instance is running|Multiple Unity instances cannot open the same project' 1).Count -gt 0) {
    Grave "Un autre Unity a ce projet ouvert : fermer l'éditeur (File > Exit), puis relancer."
  }
  $methode = @(Lignes $Journal 'executeMethod.*(could not be found|not found)' 3)
  if ($methode.Count -gt 0) {
    Grave "Méthode du contrat introuvable : son script n'existe pas encore, ou son assemblage n'a pas compilé."
    foreach ($e in $methode) { Dire ('      ' + $e) 'Red' }
  }
  if (@(Lignes $Journal 'Scripts have compiler errors|compilation errors' 1).Count -gt 0 -and $erreursCS.Count -eq 0) {
    Grave 'Unity signale des erreurs de compilation (voir le journal).'
  }
  if (@(Lignes $Journal 'No valid Unity Editor license|license is not active|Unity has not been activated' 1).Count -gt 0) {
    Grave "Licence Unity absente ou inactive : ouvrir Unity Hub, se connecter, Preferences > Licenses > Add (Personal gratuite)."
  }

  $exceptions = @(Lignes $Journal '(Exception|Error):' 5)
  if ($exceptions.Count -gt 0 -and $erreursCS.Count -eq 0) {
    Alerte 'Exceptions ou erreurs relevées dans le journal (les dernières) :'
    foreach ($e in $exceptions) { Dire ('      ' + $e) 'Yellow' }
  }
  if (@(Lignes $Journal 'Exiting batchmode successfully' 1).Count -gt 0) { Bon 'Unity indique : « Exiting batchmode successfully ».' }
  if (@(Lignes $Journal 'Aborting batchmode due to' 1).Count -gt 0) { Grave 'Unity indique : « Aborting batchmode » (arrêt sur erreur).' }
  Dire ("  Journal complet : " + $Journal)
}

# Résultats des tests (format XML de NUnit 3, écrit par -testResults).
function Resume-Tests([string]$Xml) {
  if (-not (Test-Path -LiteralPath $Xml -PathType Leaf)) {
    Grave "Pas de fichier de résultats ($Xml) : les tests n'ont pas tourné (erreurs de compilation ?)."
    return $false
  }
  try {
    [xml]$doc = Get-Content -LiteralPath $Xml -Raw -Encoding UTF8
  } catch {
    Grave "Fichier de résultats illisible : $Xml"
    return $false
  }
  $run = $doc.SelectSingleNode('/test-run')
  if ($null -eq $run) { Grave 'Fichier de résultats sans élément test-run.'; return $false }
  $total = $run.GetAttribute('total'); $passes = $run.GetAttribute('passed'); $echecs = $run.GetAttribute('failed')
  $ignores = $run.GetAttribute('skipped'); $incertains = $run.GetAttribute('inconclusive'); $verdict = $run.GetAttribute('result')
  $ligne = "Tests EditMode : $passes réussis sur $total ; $echecs en échec ; $ignores ignorés ; $incertains non conclusifs (résultat : $verdict)."
  $ok = ($verdict -like 'Passed*') -and ($echecs -eq '0')
  if ($ok) { Bon $ligne } else { Grave $ligne }
  $n = 0
  foreach ($cas in $doc.SelectNodes("//test-case[@result='Failed']")) {
    if ($n -ge 10) { Dire '      (autres échecs dans le fichier XML)' 'Red'; break }
    $message = ''
    $noeud = $cas.SelectSingleNode('failure/message')
    if ($null -ne $noeud) { $message = ((@($noeud.InnerText.Trim() -split "`r?`n") | Where-Object { $_.Trim() -ne '' } | Select-Object -First 3) -join ' / ') }
    Dire ('      ' + $cas.GetAttribute('fullname') + ' : ' + $message) 'Red'
    $n++
  }
  Dire ("  Résultats : " + $Xml)
  return $ok
}

# ---------------------------------------------------------------------------------------------------
# 4. Lancer une étape et attendre la fin
# ---------------------------------------------------------------------------------------------------
function Lancer-Etape([string]$Nom, [string[]]$Arguments, [string]$Journal) {
  Titre $Nom
  $ligne = ($Arguments | ForEach-Object { Citer $_ }) -join ' '
  Dire ('  ' + (Citer $script:UnityExe) + ' ' + $ligne) 'DarkGray'
  $debut = Get-Date
  $limite = $debut.AddMinutes($DelaiMinutes)
  $p = Start-Process -FilePath $script:UnityExe -ArgumentList $ligne -PassThru
  $null = $p.Handle   # garde la main sur le processus : sans cela, ExitCode peut rester vide sous Windows PowerShell
  $dernierAffichage = $debut
  while (-not $p.WaitForExit(5000)) {
    $maintenant = Get-Date
    if ($maintenant -gt $limite) {
      Grave "Délai de $DelaiMinutes min dépassé : arrêt de Unity."
      # Sous Windows, taskkill /T arrête aussi les processus lancés par Unity (compilateur de shaders, etc.).
      if ($env:OS -eq 'Windows_NT') { try { & taskkill.exe /PID $p.Id /T /F | Out-Null } catch { } }
      try { if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force } } catch { }
      Resume-Journal $Journal
      return 124
    }
    if (($maintenant - $dernierAffichage).TotalSeconds -ge 30) {
      $ecoule = $maintenant - $debut
      Dire ('  ... {0} min {1:00} s : {2}' -f [int][math]::Floor($ecoule.TotalMinutes), $ecoule.Seconds, (Derniere-Ligne $Journal)) 'DarkGray'
      $dernierAffichage = $maintenant
    }
  }
  $p.WaitForExit()
  $code = $p.ExitCode
  if ($null -eq $code) { $code = 1 }
  $duree = (Get-Date) - $debut
  $texte = ('Code de sortie de Unity : {0} (en {1} min {2:00} s)' -f $code, [int][math]::Floor($duree.TotalMinutes), $duree.Seconds)
  if ($code -eq 0) { Bon $texte } else { Grave $texte }
  Resume-Journal $Journal
  return $code
}

# ---------------------------------------------------------------------------------------------------
# 5. Programme
# ---------------------------------------------------------------------------------------------------
if (-not ($Installer -or $Configurer -or $Tests -or $Construire -or $Tout)) {
  Dire 'Portal Rush (Unity) : lancer Unity en mode batch, éditeur fermé.'
  Dire ''
  Dire '  powershell -ExecutionPolicy Bypass -File outils\unity\unity.ps1 -Tout'
  Dire '  powershell -ExecutionPolicy Bypass -File outils\unity\unity.ps1 -Installer | -Configurer | -Tests | -Construire'
  Dire ''
  Dire '  -Unity <chemin de Unity.exe>   (sinon UNITY_EXE, sinon la 6000.3 la plus récente de Unity Hub)'
  Dire '  -Projet <dossier du projet>     (sinon unity\PortalRush du dépôt)'
  Dire '  -DelaiMinutes <n>               (durée maximale d''une étape, 120 par défaut)'
  Dire ''
  Dire '  Mode d''emploi complet : docs\UNITY_MIGRATION.md'
  exit 0
}

# Le projet
if (-not $Projet) {
  $Projet = Join-Path (Join-Path (Join-Path (Join-Path $PSScriptRoot '..') '..') 'unity') 'PortalRush'
}
if (-not (Test-Path -LiteralPath (Join-Path $Projet 'Assets') -PathType Container)) {
  Grave "Projet Unity introuvable (pas de dossier Assets) : $Projet"
  exit 11
}
$Projet = (Resolve-Path -LiteralPath $Projet).Path.TrimEnd('\', '/')
$racineDepot = (Resolve-Path -LiteralPath (Join-Path (Join-Path $Projet '..') '..')).Path

# Unity
try { $script:UnityExe = Trouver-Unity $Unity } catch { Grave $_.Exception.Message; exit 9 }
if (-not $script:UnityExe) {
  Grave 'Unity 6.3 introuvable.'
  Dire '      Installer Unity 6.3 LTS (6000.3.x) avec Unity Hub, module Web Build Support,'
  Dire '      ou donner le chemin : -Unity "C:\...\Editor\Unity.exe" (ou la variable UNITY_EXE).'
  exit 9
}

Titre 'Portal Rush (Unity) : mode batch'
Dire ('  Unity   : ' + $script:UnityExe)
Dire ('  Projet  : ' + $Projet)

# Version attendue par le projet (ProjectSettings\ProjectVersion.txt), si elle est déjà écrite.
$fichierVersion = Join-Path (Join-Path $Projet 'ProjectSettings') 'ProjectVersion.txt'
if (Test-Path -LiteralPath $fichierVersion -PathType Leaf) {
  $attendue = ''
  foreach ($l in (Get-Content -LiteralPath $fichierVersion)) { if ($l -match '^m_EditorVersion:\s*(\S+)') { $attendue = $Matches[1] } }
  $dossierVersion = Split-Path -Leaf (Split-Path -Parent (Split-Path -Parent $script:UnityExe))
  if ($attendue) {
    if ($dossierVersion -eq $attendue) { Bon "Version de l'éditeur = version du projet ($attendue)." }
    elseif ((Cle-Version $dossierVersion) -ge 0 -and (Cle-Version $attendue) -ge 0 -and (Cle-Version $dossierVersion) -lt (Cle-Version $attendue)) {
      Alerte "L'éditeur trouvé ($dossierVersion) est plus ancien que celui du projet ($attendue) : installer $attendue (ou une 6000.3 plus récente) avec Unity Hub, ou donner -Unity."
    }
    elseif ((Cle-Version $dossierVersion) -ge 0) { Alerte "Le projet indique $attendue, l'éditeur trouvé est $dossierVersion (plus récent, même série 6000.3) : Unity mettra le projet à jour ; enregistrer ensuite ProjectVersion.txt." }
  }
}

# Module Web Build Support : il s'installe dans Editor\Data\PlaybackEngines\WebGLSupport (emplacement
# habituel ; s'il a changé, ce n'est qu'un avertissement).
$moduleWeb = Join-Path (Join-Path (Join-Path (Split-Path -Parent $script:UnityExe) 'Data') 'PlaybackEngines') 'WebGLSupport'
if (-not (Test-Path -LiteralPath $moduleWeb -PathType Container)) {
  Alerte "Module Web Build Support introuvable ($moduleWeb). Unity Hub > Installs > (la 6000.3) > Manage > Add modules > Web Build Support."
}

if (Projet-Ouvert $Projet) {
  Grave "Le projet est ouvert dans l'éditeur Unity. Le mode batch ne peut pas ouvrir un projet déjà ouvert :"
  Dire '      fermer l''éditeur (File > Exit), attendre quelques secondes, puis relancer ce script.'
  exit 10
}

# Les journaux, dans un dossier ignoré par git.
$dossierJournaux = Join-Path (Join-Path $Projet 'Logs') 'batch'
New-Item -ItemType Directory -Force -Path $dossierJournaux | Out-Null
$horodatage = Get-Date -Format 'yyyyMMdd-HHmmss'
Dire ('  Journaux : ' + $dossierJournaux)

$etapes = @()
if ($Tout -or $Installer) { $etapes += 'Installer' }
if ($Tout -or $Configurer) { $etapes += 'Configurer' }
if ($Tout -or $Tests) { $etapes += 'Tests' }
if ($Tout -or $Construire) { $etapes += 'Construire' }

$codeFinal = 0
foreach ($etape in $etapes) {
  $journal = Join-Path $dossierJournaux ("$horodatage-" + $etape.ToLowerInvariant() + '.log')
  $commun = @('-batchmode')
  switch ($etape) {
    'Installer' {
      $upm = Join-Path $dossierJournaux "$horodatage-installer-upm.log"
      $arguments = $commun + @('-nographics', '-projectPath', $Projet, '-buildTarget', 'WebGL',
        '-executeMethod', 'PortalRush.Installation.Installateur.InstallerEnBatch', '-logFile', $journal, '-upmLogFile', $upm)
      $code = Lancer-Etape 'Installer les paquets' $arguments $journal
    }
    'Configurer' {
      $arguments = $commun + @('-projectPath', $Projet, '-buildTarget', 'WebGL',
        '-executeMethod', 'PortalRush.Editeur.Batch.Configurer', '-logFile', $journal)
      $code = Lancer-Etape 'Configurer (URP, qualité, Web, matériaux, scène)' $arguments $journal
    }
    'Tests' {
      $xml = Join-Path $dossierJournaux "$horodatage-tests.xml"
      $arguments = $commun + @('-nographics', '-projectPath', $Projet, '-buildTarget', 'WebGL',
        '-runTests', '-testPlatform', 'EditMode', '-testResults', $xml, '-logFile', $journal)
      $code = Lancer-Etape 'Tests EditMode (rejeu des parties de référence)' $arguments $journal
      $testsOk = Resume-Tests $xml
      if ($code -eq 0 -and -not $testsOk) { $code = 2 }
      switch ($code) {
        2 { Grave 'Code 2 : au moins un test a échoué.' }
        3 { Grave "Code 3 : les tests n'ont pas pu tourner (souvent : erreurs de compilation)." }
        4 { Grave 'Code 4 : plateforme de test introuvable.' }
      }
    }
    'Construire' {
      $arguments = $commun + @('-projectPath', $Projet, '-buildTarget', 'WebGL',
        '-executeMethod', 'PortalRush.Editeur.Batch.Construire', '-logFile', $journal)
      $avant = (Get-Date).AddSeconds(-5)
      $code = Lancer-Etape 'Construire le build Web (public\rush-unity)' $arguments $journal
      $manifeste = Join-Path (Join-Path (Join-Path $racineDepot 'public') 'rush-unity') 'portal-rush.json'
      if (Test-Path -LiteralPath $manifeste -PathType Leaf) {
        $fichier = Get-Item -LiteralPath $manifeste
        Dire ('  Manifeste : ' + $manifeste + ' (écrit le ' + $fichier.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss') + ')')
        # Lu champ par champ (sans ConvertFrom-Json, qui transforme les dates différemment selon la version de PowerShell).
        $brut = Get-Content -LiteralPath $manifeste -Raw -Encoding UTF8
        $champs = @{}
        foreach ($nom in @('version', 'unity', 'compression', 'octets', 'loader')) {
          if ($brut -match ('"' + $nom + '"\s*:\s*"?([^",}]+)"?')) { $champs[$nom] = $Matches[1].Trim() } else { $champs[$nom] = '?' }
        }
        $taille = '?'
        if ($champs['octets'] -match '^\d+$') { $taille = [math]::Round([double]$champs['octets'] / 1000000, 1).ToString() + ' Mo' }
        Dire ('      version ' + $champs['version'] + ', Unity ' + $champs['unity'] + ', compression ' + $champs['compression'] + ', ' + $taille)
        if ($champs['loader'] -eq '?') { Alerte 'Le manifeste ne donne pas le chargeur (champ loader) : à vérifier.' }
        if ($code -eq 0 -and $fichier.LastWriteTime -lt $avant) {
          Alerte "Le manifeste date d'avant ce build : il n'a pas été réécrit (à vérifier)."
        }
      } elseif ($code -eq 0) {
        Alerte "Build signalé réussi, mais pas de manifeste $manifeste : le chargeur du portfolio ne trouvera pas le build."
      }
    }
  }
  if ($code -ne 0) {
    $codeFinal = $code
    if ($etapes.Count -gt 1) { Grave "Arrêt : l'étape « $etape » a échoué ; les suivantes ne sont pas lancées." }
    break
  }
}

Titre 'Bilan'
if ($codeFinal -eq 0) { Bon ('Étapes réussies : ' + ($etapes -join ', ') + '.') }
else { Grave ("Échec (code $codeFinal). Lire le journal indiqué ci-dessus ; les erreurs « error CS... » donnent le fichier et la ligne.") }
Dire "  Rien n'a été publié ni envoyé sur GitHub : enregistrer et pousser reste à faire à la main (voir docs\UNITY_MIGRATION.md)."
exit $codeFinal
