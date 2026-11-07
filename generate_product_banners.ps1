Add-Type -AssemblyName System.Drawing

$targetW = 1024
$targetH = 384

function Create-RoundedRectanglePath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $arc = New-Object System.Drawing.RectangleF($x, $y, $diameter, $diameter)
    
    # Top Left
    $path.AddArc($arc, 180, 90)
    
    # Top Right
    $arc.X = $x + $width - $diameter
    $path.AddArc($arc, 270, 90)
    
    # Bottom Right
    $arc.Y = $y + $height - $diameter
    $path.AddArc($arc, 0, 90)
    
    # Bottom Left
    $arc.X = $x
    $path.AddArc($arc, 90, 90)
    
    $path.CloseFigure()
    return $path
}

function Generate-BrandBanner {
    param(
        [string]$Filename,
        [string]$BrandTitle,
        [string]$Subtitle,
        [System.Drawing.Color]$BgDark,
        [System.Drawing.Color]$AccentColor,
        [System.Drawing.Color]$SecondaryColor,
        [string]$BrandType
    )

    $bmp = New-Object System.Drawing.Bitmap($targetW, $targetH)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # 1. Base Gradient Background
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($targetW, $targetH)),
        $BgDark,
        [System.Drawing.Color]::FromArgb(255, 6, 9, 14)
    )
    $g.FillRectangle($bgBrush, 0, 0, $targetW, $targetH)
    $bgBrush.Dispose()

    # 2. Futuristic Curved Waves / 3D Swooshes
    $wavePath1 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $wavePath1.AddBezier(0, 384, 250, 180, 600, 300, 1024, 80)
    $wavePath1.AddLine(1024, 384, 0, 384)
    $wavePath1.CloseFigure()
    $waveBrush1 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 200)),
        (New-Object System.Drawing.Point(1024, 384)),
        [System.Drawing.Color]::FromArgb(55, [int]$AccentColor.R, [int]$AccentColor.G, [int]$AccentColor.B),
        [System.Drawing.Color]::FromArgb(10, 10, 15, 22)
    )
    $g.FillPath($waveBrush1, $wavePath1)
    $waveBrush1.Dispose()
    $wavePath1.Dispose()

    $wavePath2 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $wavePath2.AddBezier(0, 120, 350, 260, 700, 100, 1024, 240)
    $wavePath2.AddLine(1024, 0, 0, 0)
    $wavePath2.CloseFigure()
    $waveBrush2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(1024, 200)),
        [System.Drawing.Color]::FromArgb(45, [int]$SecondaryColor.R, [int]$SecondaryColor.G, [int]$SecondaryColor.B),
        [System.Drawing.Color]::FromArgb(5, 5, 8, 12)
    )
    $g.FillPath($waveBrush2, $wavePath2)
    $waveBrush2.Dispose()
    $wavePath2.Dispose()

    # Dynamic glowing rim lines
    $penGlow = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(190, [int]$AccentColor.R, [int]$AccentColor.G, [int]$AccentColor.B), 2.5)
    $g.DrawBezier($penGlow, 0, 384, 250, 180, 600, 300, 1024, 80)
    $penGlow.Dispose()

    $penGlow2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(130, [int]$SecondaryColor.R, [int]$SecondaryColor.G, [int]$SecondaryColor.B), 1.8)
    $g.DrawBezier($penGlow2, 0, 120, 350, 260, 700, 100, 1024, 240)
    $penGlow2.Dispose()

    # Ambient Light Sphere on right side behind card
    $lightPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $lightPath.AddEllipse(640, 40, 340, 300)
    $pgh = New-Object System.Drawing.Drawing2D.PathGradientBrush($lightPath)
    $pgh.CenterColor = [System.Drawing.Color]::FromArgb(90, [int]$AccentColor.R, [int]$AccentColor.G, [int]$AccentColor.B)
    $pgh.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.FillPath($pgh, $lightPath)
    $pgh.Dispose()
    $lightPath.Dispose()

    # 3. 3D Rounded Squircle Card on the Right (715, 65, 250, 250)
    [int]$cardX = 715; [int]$cardY = 65; [int]$cardW = 250; [int]$cardH = 250; [int]$cardR = 48
    
    # Outer Glow / Drop Shadow for Card
    for ($i = 5; $i -ge 1; $i--) {
        $shadowPath = Create-RoundedRectanglePath ($cardX - $i) ($cardY - $i + 4) ($cardW + $i*2) ($cardH + $i*2) ($cardR + $i)
        $sPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb([int](18 / $i), [int]$AccentColor.R, [int]$AccentColor.G, [int]$AccentColor.B), 2.0)
        $g.DrawPath($sPen, $shadowPath)
        $sPen.Dispose()
        $shadowPath.Dispose()
    }

    # Card Body Gradient
    $cardPath = Create-RoundedRectanglePath $cardX $cardY $cardW $cardH $cardR
    [int]$topR = [Math]::Min(255, [int]($BgDark.R + 25))
    [int]$topG = [Math]::Min(255, [int]($BgDark.G + 30))
    [int]$topB = [Math]::Min(255, [int]($BgDark.B + 40))
    $cardBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point($cardX, $cardY)),
        (New-Object System.Drawing.Point(($cardX + $cardW), ($cardY + $cardH))),
        [System.Drawing.Color]::FromArgb(245, $topR, $topG, $topB),
        [System.Drawing.Color]::FromArgb(255, 12, 16, 22)
    )
    $g.FillPath($cardBrush, $cardPath)
    $cardBrush.Dispose()

    # Card Gloss Highlight Border
    $cardBorderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, [int]$AccentColor.R, [int]$AccentColor.G, [int]$AccentColor.B), 2.5)
    $g.DrawPath($cardBorderPen, $cardPath)
    $cardBorderPen.Dispose()

    # Glass reflection curve across card
    $reflPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $reflPath.AddArc($cardX, $cardY, ($cardR * 2), ($cardR * 2), 180, 90)
    $reflPath.AddLine(($cardX + $cardR), $cardY, ($cardX + $cardW - $cardR), $cardY)
    $reflPath.AddArc(($cardX + $cardW - $cardR * 2), $cardY, ($cardR * 2), ($cardR * 2), 270, 90)
    $reflPath.AddBezier(($cardX + $cardW), ($cardY + 80), ($cardX + $cardW * 0.6), ($cardY + 110), ($cardX + 40), ($cardY + 90), $cardX, ($cardY + 60))
    $reflPath.CloseFigure()
    $reflBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point($cardX, $cardY)),
        (New-Object System.Drawing.Point($cardX, ($cardY + 110))),
        [System.Drawing.Color]::FromArgb(40, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(0, 255, 255, 255)
    )
    $g.FillPath($reflBrush, $reflPath)
    $reflBrush.Dispose()
    $reflPath.Dispose()
    $cardPath.Dispose()

    # Draw Brand Logo Inside Squircle
    [float]$centerX = $cardX + ($cardW / 2)
    [float]$centerY = $cardY + ($cardH / 2)

    switch ($BrandType) {
        "DigitalOcean" {
            $doPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 128, 255), 16)
            $g.DrawArc($doPen, ($centerX - 50), ($centerY - 50), 100, 100, 45, 270)
            $doPen.Dispose()
            $cubeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 128, 255))
            $g.FillRectangle($cubeBrush, [int]($centerX + 8), [int]($centerY + 8), 22, 22)
            $g.FillRectangle($cubeBrush, [int]($centerX - 4), [int]($centerY + 34), 16, 16)
            $g.FillRectangle($cubeBrush, [int]($centerX - 22), [int]($centerY + 52), 11, 11)
            $cubeBrush.Dispose()
        }
        "Azure" {
            [System.Drawing.PointF[]]$poly1 = @(
                (New-Object System.Drawing.PointF(($centerX - 45), ($centerY + 45))),
                (New-Object System.Drawing.PointF(($centerX - 10), ($centerY - 55))),
                (New-Object System.Drawing.PointF(($centerX + 25), ($centerY - 10))),
                (New-Object System.Drawing.PointF(($centerX - 15), ($centerY + 45)))
            )
            [System.Drawing.PointF[]]$poly2 = @(
                (New-Object System.Drawing.PointF(($centerX + 50), ($centerY + 45))),
                (New-Object System.Drawing.PointF(($centerX + 15), ($centerY - 35))),
                (New-Object System.Drawing.PointF(($centerX + 35), ($centerY - 35))),
                (New-Object System.Drawing.PointF(($centerX + 55), ($centerY + 45)))
            )
            $azBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 120, 215))
            $azBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 80, 230, 255))
            $g.FillPolygon($azBrush1, $poly1)
            $g.FillPolygon($azBrush2, $poly2)
            $azBrush1.Dispose()
            $azBrush2.Dispose()
        }
        "Windows" {
            $wBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 164, 239))
            $g.FillRectangle($wBrush, [int]($centerX - 52), [int]($centerY - 52), 48, 48)
            $g.FillRectangle($wBrush, [int]($centerX + 4), [int]($centerY - 52), 48, 48)
            $g.FillRectangle($wBrush, [int]($centerX - 52), [int]($centerY + 4), 48, 48)
            $g.FillRectangle($wBrush, [int]($centerX + 4), [int]($centerY + 4), 48, 48)
            $wBrush.Dispose()
        }
        "CapCut" {
            $ccPen1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 255, 255), 14)
            $g.DrawLine($ccPen1, [int]($centerX - 45), [int]($centerY - 45), [int]($centerX + 45), [int]($centerY + 45))
            $g.DrawLine($ccPen1, [int]($centerX - 45), [int]($centerY + 45), [int]($centerX + 45), [int]($centerY - 45))
            $ccPen1.Dispose()
            $ccCircle = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 230, 200))
            $g.FillEllipse($ccCircle, [int]($centerX - 16), [int]($centerY - 16), 32, 32)
            $ccCircle.Dispose()
        }
        "Hotmail" {
            $mBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
                (New-Object System.Drawing.Point(($centerX - 55), ($centerY - 35))),
                (New-Object System.Drawing.Point(($centerX + 55), ($centerY + 45))),
                [System.Drawing.Color]::FromArgb(255, 0, 114, 198),
                [System.Drawing.Color]::FromArgb(255, 0, 45, 120)
            )
            $g.FillRectangle($mBrush, [int]($centerX - 55), [int]($centerY - 35), 110, 75)
            $mBrush.Dispose()
            $penFlap = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 6)
            $g.DrawLine($penFlap, [int]($centerX - 55), [int]($centerY - 35), [int]$centerX, [int]($centerY + 10))
            $g.DrawLine($penFlap, [int]$centerX, [int]($centerY + 10), [int]($centerX + 55), [int]($centerY - 35))
            $penFlap.Dispose()
        }
        "Kamatera" {
            $srvBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 150, 75, 255))
            $g.FillEllipse($srvBrush, [int]($centerX - 45), [int]($centerY - 45), 90, 50)
            $g.FillRectangle($srvBrush, [int]($centerX - 40), [int]($centerY - 10), 80, 14)
            $g.FillRectangle($srvBrush, [int]($centerX - 40), [int]($centerY + 12), 80, 14)
            $g.FillRectangle($srvBrush, [int]($centerX - 40), [int]($centerY + 34), 80, 14)
            $srvBrush.Dispose()
        }
        "Oracle" {
            $oraPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 235, 30, 30), 16)
            $g.DrawEllipse($oraPen, [int]($centerX - 50), [int]($centerY - 35), 100, 70)
            $oraPen.Dispose()
        }
        "Linode" {
            $linBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 185, 90))
            $g.FillRectangle($linBrush, [int]($centerX - 35), [int]($centerY - 45), 70, 70)
            $linBrush.Dispose()
            $linPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 8)
            $g.DrawRectangle($linPen, [int]($centerX - 35), [int]($centerY - 45), 70, 70)
            $linPen.Dispose()
        }
        "Standoff2" {
            $goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 190, 0))
            [System.Drawing.PointF[]]$shieldPoints = @(
                (New-Object System.Drawing.PointF($centerX, ($centerY - 50))),
                (New-Object System.Drawing.PointF(($centerX + 45), ($centerY - 30))),
                (New-Object System.Drawing.PointF(($centerX + 35), ($centerY + 25))),
                (New-Object System.Drawing.PointF($centerX, ($centerY + 55))),
                (New-Object System.Drawing.PointF(($centerX - 35), ($centerY + 25))),
                (New-Object System.Drawing.PointF(($centerX - 45), ($centerY - 30)))
            )
            $g.FillPolygon($goldBrush, $shieldPoints)
            $goldBrush.Dispose()
        }
    }

    # 4. Modern Typography on the Left
    $titleFont = New-Object System.Drawing.Font("Segoe UI", 48, [System.Drawing.FontStyle]::Bold)
    $subFont = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)

    # Subtitle Pill Badge
    $subSize = $g.MeasureString($Subtitle.ToUpper(), $subFont)
    $badgeW = $subSize.Width + 28
    $badgeH = 34
    $badgeX = 75
    $badgeY = 95
    $badgePath = Create-RoundedRectanglePath $badgeX $badgeY $badgeW $badgeH 17
    $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, [int]$AccentColor.R, [int]$AccentColor.G, [int]$AccentColor.B))
    $g.FillPath($badgeBrush, $badgePath)
    $badgeBrush.Dispose()
    $badgeBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, [int]$AccentColor.R, [int]$AccentColor.G, [int]$AccentColor.B), 1.5)
    $g.DrawPath($badgeBorder, $badgePath)
    $badgeBorder.Dispose()
    $badgePath.Dispose()

    [int]$subR = [Math]::Min(255, [int]($AccentColor.R + 60))
    [int]$subG = [Math]::Min(255, [int]($AccentColor.G + 60))
    [int]$subB = [Math]::Min(255, [int]($AccentColor.B + 60))
    $subTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, $subR, $subG, $subB))
    $g.DrawString($Subtitle.ToUpper(), $subFont, $subTextBrush, ($badgeX + 14), ($badgeY + 6))
    $subTextBrush.Dispose()

    # Brand Title (with subtle drop shadow)
    $titleY = 145
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 0, 0, 0))
    $g.DrawString($BrandTitle, $titleFont, $shadowBrush, 77, ($titleY + 3))
    $shadowBrush.Dispose()

    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $g.DrawString($BrandTitle, $titleFont, $whiteBrush, 75, $titleY)
    $whiteBrush.Dispose()

    # Bottom Tagline
    $tagFont = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Regular)
    $tagBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(160, 200, 215, 230))
    $g.DrawString("OFFICIAL VERIFIED • 24/7 INSTANT AUTO-DELIVERY", $tagFont, $tagBrush, 77, 235)
    $tagBrush.Dispose()
    $tagFont.Dispose()

    $titleFont.Dispose()
    $subFont.Dispose()
    $g.Dispose()

    $savePath = Join-Path "c:\Users\Administrator\Downloads\shop-bot-2026-main\shop-bot-2026-main\public" $Filename
    $bmp.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $savePath"
}

# Generate remaining product banners
Generate-BrandBanner "banner_digitalocean.png" "DigitalOcean" "Cloud Droplets" ([System.Drawing.Color]::FromArgb(255, 5, 20, 45)) ([System.Drawing.Color]::FromArgb(255, 0, 128, 255)) ([System.Drawing.Color]::FromArgb(255, 0, 210, 255)) "DigitalOcean"
Generate-BrandBanner "banner_azure.png" "Microsoft Azure" "Enterprise Cloud" ([System.Drawing.Color]::FromArgb(255, 8, 24, 48)) ([System.Drawing.Color]::FromArgb(255, 0, 120, 215)) ([System.Drawing.Color]::FromArgb(255, 0, 215, 255)) "Azure"
Generate-BrandBanner "banner_windows.png" "Windows 10/11" "Pro Licenses" ([System.Drawing.Color]::FromArgb(255, 6, 20, 42)) ([System.Drawing.Color]::FromArgb(255, 0, 164, 239)) ([System.Drawing.Color]::FromArgb(255, 80, 200, 255)) "Windows"
Generate-BrandBanner "banner_capcut.png" "CapCut Pro" "Video Creator 30D" ([System.Drawing.Color]::FromArgb(255, 12, 16, 24)) ([System.Drawing.Color]::FromArgb(255, 0, 235, 200)) ([System.Drawing.Color]::FromArgb(255, 255, 40, 120)) "CapCut"
Generate-BrandBanner "banner_hotmail.png" "Hotmail / Outlook" "Verified Accounts" ([System.Drawing.Color]::FromArgb(255, 8, 20, 40)) ([System.Drawing.Color]::FromArgb(255, 0, 114, 198)) ([System.Drawing.Color]::FromArgb(255, 0, 180, 255)) "Hotmail"
Generate-BrandBanner "banner_kamatera.png" "Kamatera Cloud" "High Speed Servers" ([System.Drawing.Color]::FromArgb(255, 18, 12, 32)) ([System.Drawing.Color]::FromArgb(255, 150, 75, 255)) ([System.Drawing.Color]::FromArgb(255, 200, 120, 255)) "Kamatera"
Generate-BrandBanner "banner_oracle.png" "Oracle Cloud" "Enterprise Cloud" ([System.Drawing.Color]::FromArgb(255, 30, 10, 12)) ([System.Drawing.Color]::FromArgb(255, 235, 35, 35)) ([System.Drawing.Color]::FromArgb(255, 255, 100, 80)) "Oracle"
Generate-BrandBanner "banner_linode.png" "Linode Cloud" "Cloud Computing" ([System.Drawing.Color]::FromArgb(255, 8, 26, 18)) ([System.Drawing.Color]::FromArgb(255, 0, 185, 90)) ([System.Drawing.Color]::FromArgb(255, 80, 235, 140)) "Linode"
Generate-BrandBanner "banner_standoff2.png" "Standoff 2" "Gaming Accounts" ([System.Drawing.Color]::FromArgb(255, 28, 20, 8)) ([System.Drawing.Color]::FromArgb(255, 255, 180, 0)) ([System.Drawing.Color]::FromArgb(255, 255, 100, 0)) "Standoff2"
