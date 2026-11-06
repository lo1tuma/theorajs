let
    pkgs = import ./nixpkgs.nix;
#    pnpm2nixRevision = "1f56ee45800805f787b6442c51c5241bfe2d82c9";
#    pnpm2nixSources = builtins.fetchTarball {
#        url = "https://github.com/adisbladis/pnpm2nix/tarball/${pnpm2nixRevision}";
#        sha256 = "16dn7z2p7rgvdczhxdligdlscnnv8bsgsfyvyb0jqvv4qxmcpi7k";
#    };
    pnpm2nixSources = ../../pnpm2nix;
in import pnpm2nixSources {
    inherit pkgs;
    nodejs = pkgs.nodejs;
    nodePackages = pkgs.nodePackages;
}
