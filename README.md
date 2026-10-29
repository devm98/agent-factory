# Factory View

A Claude Code mod that turns multi-agent work into a little office in a pane beside the conversation.

Claude, the main agent, is the manager at the gilded desk in the middle of the floor. Every subagent it starts takes a desk of its own. Agents at work type while their monitor scrolls and a bubble names the tool they run; agents waiting for your approval raise a hand; agents that finish cheer, hand in their report and head to the break room. Each agent type wears its own outfit.

- Desktop: the office is drawn as an animated SVG.
- Terminal: the mascots are drawn in half-block pixels (fullscreen layout docks the pane).
- `/factory` opens or closes the pane. Press an agent's name to open its transcript; hover a desk (desktop) to see its task, model, time running and tool calls.
- Up to 8 agents get full desks, up to 24 compact desks, and beyond that agents are grouped into rooms with counts.

## Waiting for you

When an agent asks for your approval, a toast says who is waiting and for which tool, the bell on Claude's desk rings with a count, the pane title shows how many are waiting, and those agents move to the front of the list of names.

## Wardrobe

Every agent can be dressed up, one item per slot:

| Slot | Items |
| --- | --- |
| Head | `explorer`, `beanie`, `cap`, `party`, `crown`, `headphones`, `bow` |
| Face | `glasses`, `shades` |
| Neck | `tie`, `scarf` |
| Hand | `blueprint`, `coffee` |
| Desk | `cat`, `cactus`, `photo` |

```
/factory dress <who> <item>
```

`<who>` is `claude`, an agent's name, an agent type such as `Explore` or `Plan`, or `all` for every agent at a desk now. The item `none` strips every slot and `reset` goes back to the default look. Looks chosen for a whole agent type, Claude included, are kept across sessions; a single agent's look lasts for the session.

On desktop, the **Tủ đồ** button in the pane opens a panel to pick who and what, with a preview, and `/factory wardrobe` opens it from the prompt. Desk items show on desktop only.

By default Explore agents wear the explorer hat, Plan agents carry a blueprint, review agents wear glasses, general-purpose agents wear headphones, and Claude wears a crown and tie.

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
