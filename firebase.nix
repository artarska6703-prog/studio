{pkgs}: {
  # Which nixpkgs channel to use.
  channel = "stable-24.11"; # or "unstable"

  # Packages available in your workspace
  packages = [
    pkgs.nodejs_20
    pkgs.zulu
  ];

  # Environment variables
  env = {
    NODE_ENV = "production"; # ✅ force prod mode for Next.js
  };

  services.firebase.emulators = {
    detect = false;
    projectId = "demo-app";
    services = ["auth" "firestore"];
  };

  idx = {
    extensions = [
      # Add VSCode extensions here if needed
    ];

    workspace = {
      onCreate = {
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
    };

    previews = {
      enable = true;
      previews = {
        web = {
          # ✅ Build first, then run Next.js in prod SSR mode
          command = [
            "sh"
            "-c"
            "npm run build && npm run start -- -p $PORT -H 0.0.0.0"
          ];
          manager = "web";
        };
      };
    };
  };
}
