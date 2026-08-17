@{
    Version = '0.165.0'
    Edition = 'standard'
    License = 'Apache-2.0'
    SourceUrl = 'https://github.com/gohugoio/hugo'
    LicenseUrl = 'https://github.com/gohugoio/hugo/blob/v0.165.0/LICENSE'
    ReleaseBaseUrl = 'https://github.com/gohugoio/hugo/releases/download/v0.165.0'
    ChecksumsUrl = 'https://github.com/gohugoio/hugo/releases/download/v0.165.0/hugo_0.165.0_checksums.txt'
    Artifacts = @{
        'windows-amd64' = @{
            FileName = 'hugo_0.165.0_windows-amd64.zip'
            Sha256 = 'bdd9cc7837a42389067b2d0df7858d5878ceddef21307c2dd27fa10885fbbcf9'
            BinaryName = 'hugo.exe'
        }
        'linux-amd64' = @{
            FileName = 'hugo_0.165.0_linux-amd64.tar.gz'
            Sha256 = '5c3a37a5450b3e386e5b75a87a790fea2d04a796d75e171216c80ef48a32b432'
            BinaryName = 'hugo'
        }
    }
}
