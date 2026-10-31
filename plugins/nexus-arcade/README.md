# Nexus Arcade workflow plugin

Repository package0.1.0 for conversion, reuse auditing, validation and authorized integration. It reuses the existing game-definition workflow instead of bundling another definition system.

The portable plugin.json and skills/ layout follow https://developers.openai.com/plugins/build/plugins . The repo marketplace is .agents/plugins/marketplace.json, with its source path resolved from the repository root. No MCP server, automatic hook, credentials or publish action is installed.

The package is discoverable from a supported repo marketplace. Creating these files does not prove installation or enablement in a user's client. Refresh/restart the supporting desktop client and explicitly install from the Nexus Arcade Repository marketplace when desired. This commit does not modify personal configuration or install into a local cache.

From repository root:

```sh
node plugins/nexus-arcade/scripts/validate-plugin.mjs --repo .
node plugins/nexus-arcade/scripts/inspect-game.mjs --repo . --game switchyard
node --test tests/arcade-plugin.test.mjs
```

The scripts only read the explicit repository and print JSON. They do not run game code, write files, install dependencies, change branches or contact external services. Skills guide authorized work; the manifest does not grant permissions.

References are bundled inside the plugin. Repository records remain in .agent/, gameplay source in games/, and any future proven shared gameplay code in kits/. Client installation and fresh-session behavioral evaluation remain separate checks from package tests.
