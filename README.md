# Factory View

A Claude Code mod that turns multi-agent work into a little office in a pane beside the conversation.

Claude, the main agent, is the manager at the gilded desk in the middle of the floor. Every subagent it starts takes a desk of its own. Agents at work type while their monitor scrolls and a bubble names the tool they run; agents waiting for your approval raise a hand; agents that finish cheer, hand in their report and head to the break room. Each agent type wears its own outfit.

- Desktop: the office is drawn as an animated SVG.
- Terminal: the mascots are drawn in half-block pixels (fullscreen layout docks the pane).
- `/factory` opens or closes the pane. Press an agent's name to open its transcript.
- Up to 8 agents get full desks, up to 24 compact desks, and beyond that agents are grouped into rooms with counts.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install factory-view --marketplace devm98/agent-factory
```

Answer `y` to add the marketplace, then press Enter to pick the user scope. The mod is active right away, and in every session you start after.

From a shell:

```
claude plugin install factory-view --marketplace devm98/agent-factory
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `devm98/agent-factory`, then Add plugin.

## Develop

Run Claude Code with the mod loaded from this folder:

```
claude --plugin-dir .
```

Check and test it with `claude plugin validate .` and `claude plugin test .`.

## License

MIT. Factory View is a fan-made mod and is not affiliated with Anthropic.
