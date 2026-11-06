let
    nixpkgsRevision = "02bb5e35eae8a9e124411270a6790a08f68e905b";
    nixpkgsSources = builtins.fetchTarball {
        url = "https://github.com/NixOS/nixpkgs-channels/tarball/${nixpkgsRevision}";
        sha256 = "00kr1py3m5m9f80j1664hgi1x8s3y53rkwiq0z8kwf24cpg0x35d";
    };
    initializeNixpkgs = import nixpkgsSources;
    pinVersions = import ./pinVersions.nix;
in initializeNixpkgs {
    config = {};
    overlays = [ pinVersions ];
}
