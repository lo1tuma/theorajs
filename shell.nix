let
    pkgs = import ./nix/nixpkgs.nix;
    pnpm2nix = import ./nix/pnpm2nix.nix;
    package = pnpm2nix.mkPnpmPackage {
        src = ./.;
        shrinkwrapYML = ./pnpm-lock.yaml;
        allowImpure = false;
        linkDevDependencies = true;
        overrides = {
            nodePackages = pkgs.nodePackages-10_x; # because the `semver` module doesn’t exist in 10_x
        };
    };
    env = pnpm2nix.mkPnpmEnv package;
in
    pkgs.mkShell {
        buildInputs = [ pkgs.git-lfs pkgs.nodejs pkgs.pnpm ];

        #shellHook = ''
        #    echo "${package}"
        #    export NODE_PATH=${pkgs.lib.getLib env}/node_modules
        #'';
    }
