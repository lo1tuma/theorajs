self: super: let
    nodejs = super.nodejs-slim-11_x;
    nodePackages = super.nodePackages_10_x;
in {
    inherit nodejs nodePackages;
    nodejs-slim = nodejs;
    pnpm = nodePackages.pnpm.override {
        buildInputs = [ nodejs ];
        postInstall = let
            pnpmLibPath = super.lib.makeBinPath [ nodejs.passthru.python nodejs ];
        in ''
            for prog in $out/bin/*; do
                wrapProgram "$prog" --prefix PATH : ${pnpmLibPath}
            done
        '';
    };
}
