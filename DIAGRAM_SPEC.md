> **Now part of the Report Builder.** This app is the Report Builder's Diagram tab (`src/diagram/`, built into
> `diagram.html`). Where this spec talks about saving in `localStorage`, share links as the real save, or pasting
> the link on the Team Log cover, read `REPORT_BUILDER_SPEC.md` instead: the diagram now saves in the team file, and
> every Team Log export includes it. Everything about what it records, and its hard rules, still holds.

# Network Diagram app: build spec

Written November 16, 2026 for whoever builds this (most likely a later Claude session). Read `WORKFLOW.md` first for
the project's conventions. Build version 1, stop for Gabriel to test, then build version 2.

## 1. Purpose

Each Cyber Hub team keeps one running network diagram from Cyber Hub 02 to Cyber Hub 13. Today that is a Google
Slides starter. This app replaces it with a purpose-built tool: students record what they built on the rack, the app
draws it, and (version 2) lets them trace a packet through their own configuration.

The diagram is graded once, as the SSP diagram in Cyber Hub 13. It is also a troubleshooting and check-off tool.

## 2. Hard rule: the app never supplies answers

This rule outranks every feature below. If a feature can't be built without breaking it, drop the feature.

1. **Everything drawn comes from what the team typed.** The one exception (Gabriel's decision, Nov 24 2026) is the
   Addressing table's Planned column: the addresses from Reference: Rack Schema and VLAN Plan, filled in from the
   rack number on the Team Log cover, with entries that differ marked in amber. It replaced the Team Log's rack
   sheet. The plan holds addresses, masks and gateways only: no port modes, VLAN tags, routes or policies, and the
   canvas, checks and exports never use it.
2. **Messages say what is missing or contradictory, never what the value should be.** Allowed: "The firewall has no
   route that matches 10.3.20.100." Not allowed: "Add a route to 10.3.20.0/24 through 10.3.100.254."
3. **A message may quote only values the team entered** (the Planned column is a table, not a message). No message introduces a new address, VLAN, port or name.
4. **The standard is what real equipment would tell them.** A failed trace should reveal about as much as a failed
   ping plus reading the routing table: where the packet stopped and why that device couldn't forward it.
5. **No "check against the answer" mode in the student app.** The instructor comparison (section 8) uses a reference
   diagram the instructor supplies as a link. It is never bundled with the app, because students can read the source.

What the app may know, because students already have it on the reference pages: the list of devices in the rack and
their names, the switch's port names (XG1 to XG12, OOB), the firewall's interface names (wan1, internal, dmz,
guest Wi-Fi), and general networking rules.

Before release, test the rule directly: load an empty diagram and a deliberately wrong one, read every message the
app can produce, and confirm none states a correct value.

## 3. Where it lives

- **Settled:** the diagram is the Report Builder's Diagram tab (`src/diagram/` in `GLGoltz/report-builder`, built
  into `diagram.html`). The old standalone app (`GLGoltz/network-diagram`) and the Rack Explorer's `/diagram/` redirect were deleted on Nov 24 2026.
- Follow the Rack Explorer's conventions: plain JavaScript, no framework, a Node build script that writes one
  self-contained `index.html`, source split into `src/`. No runtime network requests, no analytics, no fonts from a CDN.
- Match the Cyber Hub look: navy `#003366`, body `#334155`, borders `#cbd5e1`, page `#f8fafc`, amber for values the
  team entered. Light theme only is fine; it has to print and export cleanly.
- It opens in its own browser tab. Do not rely on it inside a Canvas iframe: browsers can block storage there.

## 4. Data model

One JSON document, with a `v` (schema version) field. Everything is optional so a diagram can be half finished.

- **devices[]**: `id`, `kind`, `name`, `x`, `y`, plus kind-specific fields.
  - The device set is fixed, because every rack is built the same way: provider (the instructor rack), Internet laptop, firewall, guest
    laptop, core switch, hypervisor with three VM slots (web server, FTP server, scanner), NAS, admin laptop,
    vulnerable Pi and team laptop. Nothing is added, deleted or moved.
  - **Endpoint** (laptop, NAS, Pi, hypervisor host, VM): `hostname`, `address`, `mask`, `gateway`, `dhcp`.
    A VM also has `vlanTag` (blank means untagged).
  - **Switch** (no separate VLAN list; ports carry their VLANs): `hostname`, `svis[]` (`vlan`, `address`, `mask`), `routes[]` (`dest`, `nextHop`),
    `ports[]` (`name`, `mode` access/trunk, `pvid`, `tagged[]`, `shutdown`), `dhcpPools[]` (`vlan`, `start`, `end`,
    `router`).
  - **Firewall** (no administrative access settings): `hostname`, `interfaces[]` (`name`, `address`, `mask`),
    `routes[]` (`dest`, `gateway`, `interface`), `vips[]` (`name`, `external`, `port`, `mapped`),
    `policies[]` (`name`, `from`, `to`, `source`, `dest`, `services[]`, `nat`, `log`), guest Wi-Fi as an interface
    with `ssid`.
  - **Provider** (the instructor rack, which plays the internet provider): `address`, `mask` for its side of the
    rack's uplink. Ports `Uplink` (to wan1) and `Internet Wi-Fi` (to the Internet laptop, drawn dashed like the guest Wi-Fi). Older saves that used `LAN`,
    `LAN 1` and `LAN 2` are mapped to these on load, as is the earlier `Internet`.
- **links[]**: `id`, `a` and `b`, each `{device, port}`. `port` is a switch port name, a firewall interface name, or
  blank for a single-port endpoint. A VM has no link; it rides the hypervisor's link. The guest laptop's link to the
  firewall is wireless (drawn dashed).
- **meta**: `company`, `updated`, and optional `logo`: a small data URL (PNG, JPEG or WebP, at most 40,000 characters),
  shrunk on upload to about 300 by 160 pixels so the share link stays short. Drawn in the diagram's top-right corner and in
  Export PNG. With no logo, that corner shows an "Upload logo" placeholder on screen only (exports leave it empty);
  selecting the logo offers Change and Remove. Reset diagram keeps the company name and the logo.
- **Mask fields** store the prefix length alone, such as `24`. The field shows a fixed `/` in front of the box, and a typed
  `/24` or dotted mask is converted to the prefix.

Typing is forgiving: accept `10.3.20.254/24` in an address field and split it, trim spaces, and show an inline
format hint for something that isn't an address. A format hint is not an answer.

## 5. Version 1: draw, save, share, export

- **Canvas (SVG), fixed layout.** Every rack has the same devices, so positions are fixed and follow the traffic
  path top to bottom: provider (with the Internet laptop beside it), firewall (with the guest laptop beside it),
  core switch, then the hosts in a row. Teams add only laptops and virtual machines, and cannot delete or move the
  fixed devices. The switch is drawn with its ports XG1 to XG12 and OOB, each showing the mode and VLANs entered; the
  firewall shows its interfaces as tabs on its edges. Cables plug into the recorded port and are routed at right
  angles. To record a cable, drag from a port, an interface tab or the dot on top of a device to the other end.
  Click a device or cable to edit it in the side panel, which is always shown. With nothing selected it says how to
  get started. Esc clears the selection. The drawing scales to fit the space beside the panel.
- **Grid layout.** The drawing sits on a five-column grid (240-unit columns, 40-unit gaps, 40-unit margins): the
  provider and firewall span two columns, the Internet and guest laptops sit in the fourth, the logo, key and VLAN
  list in the fifth, the switch spans all five, and each host takes one column. Rows are 64 units apart. The SVG
  scales to fit the space left on screen (width and height), so there's nothing to scroll down to 420px of height.
  Phones keep a sideways scroll instead, so the text stays readable.
- **Reset diagram** button in the toolbar clears every setting and cable (undoable).
- **One cable per port.** A port, or a device with a single network port, holds one cable: recording a new one
  replaces the old (undoable).
- **Cables** run at right angles around every box (an orthogonal path search), end in a plug seated in the port,
  and fan out from the switch in nested lanes so they never cross. Connected ports are shaded.
- **Small screens:** the page never scrolls sideways; the diagram scrolls inside its own frame.
- **Addressing table.** A "Diagram | Addressing table" switch above the drawing. The table view lists every interface
  (device, hostname, interface, VLAN, IP address, subnet mask, default gateway) and every cable (device, port, connects to,
  port, switch port mode and VLANs), built only from what the team entered, with a Copy table button for Google Docs.
  The SSP (Cyber Hub 13) starts its hardware inventory from this table.
  Selecting a row opens that device's editor. (This replaced an earlier List view.)
- **Ports on every device.** Single-port devices show their one port as a labeled tab (NIC 1, LAN 1, eth0, Ethernet,
  Wi-Fi). Cables start only from a port; clicking a box selects it. The provider has two ports, Uplink and Internet Wi-Fi.
- **Target screens:** laptops and tablets. Phones are not a target.
- **Undo and redo**, at least 50 steps.
- **Save.** Autosave to `localStorage` on every change, wrapped in try/catch. Show "Saved in this browser" with the time.
- **Share link.** "Copy share link" encodes the whole document into the URL fragment (JSON, compressed with
  `CompressionStream('deflate-raw')` when available, then base64url). Opening a link loads that diagram; if the
  browser already holds a different one, ask which to keep. The link is the durable save and what goes on the Team
  Log cover page. Say so in the interface.
- **File.** Download and open a `.json` file as a second backup.
- **Export PNG** of the diagram at 2x, with the company name and date, for the Team Log and the SSP. Also a print
  style sheet.
- **Empty state.** A new diagram shows the named devices and three lines of instruction. Nothing else.

Stop here and give Gabriel the link to test before starting version 2.

## 6. Version 2a: consistency checks

A "Check my diagram" panel lists contradictions inside the team's own entries. Each item names the devices
involved and can be clicked to select them. Checks:

- The same address on two devices.
- A gateway that isn't in the device's own subnet, or that no device on the diagram holds.
- Two devices on one VLAN with different masks.
- A switch port used by two links, or a link to a port that is shut down.
- An access port with tagged VLANs, or a trunk with no untagged VLAN.
- A VM tag that the hypervisor's switch port doesn't carry.
- A DHCP pool that overlaps a fixed address entered on the diagram.
- A route whose next hop isn't on any connected network of that device.
- A device with an address but no link (VMs excepted).

No check compares against a plan, and none says a diagram is "complete" or "correct". The panel's wording when
nothing is found: "No contradictions found. That is not the same as correct: test it on the rack."

## 7. Version 2b: trace a packet

The student picks a source device, a destination (a device or a typed address), and a service: Ping, HTTP, HTTPS,
SSH, FTP, DNS. The app walks the packet hop by hop through the entered configuration, highlights the path on the
canvas, and lists each hop with what decided it. It stops at the first hop that can't forward, and says why.

### Path rules (get these exactly right)

**At an endpoint (source or any host):**
1. No address: stop, "has no address".
2. Destination in the endpoint's own subnet: deliver by layer 2 (below).
3. Otherwise send to its gateway. No gateway: stop. Then deliver to the gateway by layer 2.

**Layer 2 delivery between two addresses on one subnet.** Both ends must be in the same broadcast domain:
- An endpoint's domain comes from its link. To a switch port in access mode: that port's PVID. In trunk mode:
  untagged traffic uses the trunk's untagged VLAN.
- A VM uses its host's link. With a tag: that VLAN, and the trunk must list it as tagged, otherwise stop. Without
  a tag: the trunk's untagged VLAN.
- A firewall interface joins the VLAN of the switch port it is linked to.
- A switch SVI is in its own VLAN.
- The provider's Uplink port shares one segment with the firewall's wan1. Its Internet Wi-Fi port is a separate
  network (CyberHub-Internet, 198.51.100.0/24 in the lab) that the provider routes to.
- Guest laptops share one wireless segment with the firewall's guest interface.
- No link drawn, a shut-down port, or two different VLANs: stop, and name which of the three it was.

**At the switch (when the packet was sent to one of its SVI addresses):**
1. The gateway address must be one of the SVIs. If not: stop, "nothing on the switch answers at" that address.
2. Destination in a subnet of any SVI: deliver by layer 2 in that VLAN.
3. Otherwise the longest matching static route (including a default). No match: stop, "the switch has no route".
4. The next hop must be in a subnet of one of the SVIs, then layer 2 to the next hop.

**At the firewall.** The ingress interface is the one whose segment the packet arrived on.
0. Source check first, as FortiOS does: the firewall must have a connected subnet or route that reaches the
   packet's source through the ingress interface. If not: stop, "the firewall has no route back to the sender
   through this interface".
1. If the ingress is wan1 and the destination and service match a VIP: rewrite the destination to the VIP's
   mapped address, and note it as a hop.
2. Destination is the ingress interface's own address: the packet arrives. Whether the firewall answers depends on
   administrative access, which the app does not record, so say "It reaches the firewall. Whether the firewall
   answers depends on its administrative access: test it on the rack." End of trace.
3. Destination is another address of the firewall, on a different interface: **do not decide.** Show "The app
   can't predict this one. Test it on the rack." FortiOS behavior here is subtle and guessing would mislead.
4. Otherwise find the egress: connected subnets first, then the longest matching static route. No match: stop.
5. Policy check: a recorded policy must match ingress interface, egress interface, source address, destination
   address (after any VIP rewrite) and service. A blank source or destination matches anything; a service list
   containing ALL matches every service. No match: stop, "no policy you recorded allows this".
6. If the matching policy has NAT on, note that the source becomes the egress interface's address.
7. Deliver by layer 2 to the destination or the route's gateway.

**At the provider.** It answers only for its own address. Anything else: end with "Leaves through the provider
router. The mock internet ends here."

**The reply.** After a successful forward trace, check the return path with the same routing rules from the
destination back to the source (to the NAT address when NAT applied). The firewall is stateful, so skip its policy
check on the way back. A reply that can't route is a failure, shown as "the request arrives, but the reply can't
get back", with the hop where it stops. This case matters: a missing return route is a classic fault in these labs.

**Anything not modelled:** say so plainly instead of guessing. Not modelled: DHCP behavior (use the entered
address), DNS, the firewall's implicit rules beyond the above, FTP data channels, anything about the NAS's NFS
permissions or host firewalls.

### Trace output

- A numbered hop list. Each line: the device, the decision ("route to 10.3.100.1 matches the default route"), and a
  pass or stop mark. The stopping line is highlighted, with its reason, and obeys section 2.
- The path drawn on the canvas, forward in navy and the return in a lighter shade.
- A "copy as text" button, so a trace can go in the Team Log.

### Acceptance tests

Build a reference diagram for a made-up rack in the test suite only (never shipped in the app bundle) from
`pages/00c_Rack_Schema_and_VLAN_Plan.html`, then assert:

| Trace | Expected |
|---|---|
| Data laptop, Ping, its own gateway | Passes |
| Data laptop, Ping, Management SVI | Passes |
| Data laptop, Ping and HTTPS, firewall internal address | Reaches the firewall (answer not predicted) |
| Data laptop, Ping, provider | Passes, NAT noted |
| Data laptop, HTTP, web server | Passes through Internal_to_DMZ |
| Internet laptop, HTTP, firewall WAN address | Passes through the VIP to the web server |
| Guest laptop, HTTP, web server | Passes |
| Guest laptop, HTTPS, firewall internal address | "Can't predict" (rule 3) |
| Guest laptop, Ping, NAS | Stops at the firewall: no policy |
| Web server, Ping, Data laptop | Stops at the firewall: no policy |
| Scanner VM, any service, FTP server | Passes through Scanner_to_DMZ |
| Data laptop, Ping, NAS | Passes (the switch routes it; no firewall involved) |

Then break the reference one fault at a time and assert where each trace stops:

| Fault | Expected |
|---|---|
| Switch default route removed | Ping to the provider stops at the switch; ping to the firewall internal address still passes |
| XG1 moved to the wrong VLAN | Ping to the firewall internal address stops at layer 2 |
| Firewall route to the Data subnet removed | Ping to the provider stops at the firewall: no route back to the sender |
| provider's address changed to another subnet | Ping to the provider: the request can't be delivered at layer 2 |
| Data laptop's gateway cleared | Ping to the NAS stops at the laptop: no gateway |
| Web VM tag cleared | HTTP to the web server stops at layer 2 |
| VLAN 40 removed from the trunk's tagged list | HTTP to the web server stops: trunk doesn't carry the tag |
| NAT turned on for the inbound policy | Still passes; NAT noted (the app doesn't judge it) |

Every stopping message in these tests must also pass the section 2 review.

## 8. Version 2c: instructor comparison

- Opened with `?compare=` plus a second share link in the URL (or a "Compare with…" field where a link is pasted).
- Shows the team's diagram with differences from the pasted reference listed by device: missing, extra, different.
- The reference is a diagram an instructor builds in the app for a rack and keeps in the Instructor Guide. The
  Rack answer sheet (Google Sheets) gives the values. The app ships no reference.
- This view exists for instructors, but it is not secret: a student could paste any two links. That is harmless
  because it only compares two diagrams they already have.

## 9. After the app works: project changes

1. `components.py`: point `TEMPLATES["network diagram starter"]` at the app, and rename the link text to
   "Network Diagram app" wherever it appears (Cyber Hub 00 Part 4, Start Here, Instructor Guide).
2. Cyber Hub 00 Part 4: "Open the Network Diagram app, copy its share link, and paste the link on the Team Log
   cover page." Keep the checkpoint line "Your network diagram shows what you built today" on Cyber Hubs 02 to 11
   and 13, and add "and its share link in the Team Log is current."
3. Reference: Troubleshooting: add one habit, "Trace it in your diagram first", and one line saying the trace
   shows what your recorded configuration would do, which may differ from what the device actually has.
4. Cyber Hub 13: the SSP diagram is the app's PNG export.
5. Instructor Guide, "The network diagram" section: replace the Slides instructions, keep the stage table, add how
   to open a team's link, how to compare, and the caveat that a trace reflects what the team typed.
6. (Done, then retired: the Google Slides starter was deleted on Nov 24 2026.)
7. Release notes: a new minor version.
8. Rebuild, publish the preview, sync the folder, update the source backup (and the `cyber-hub` repository once
   Gabriel creates it).

## 10. Known risks

- **The diagram can drift from the rack.** The trace follows what was typed, not what is configured. Say this in
  the interface next to every trace result: "This follows your diagram. If the rack behaves differently, one of
  them is wrong."
- **Share links are long.** Fine for pasting into a Google Doc. Test one in the Team Log template.
- **Lost work.** Browser storage can be cleared. The interface should nudge toward copying the share link after
  changes, without nagging.
- **Scope creep toward a simulator.** The app records and reasons about a configuration. It does not emulate
  devices, generate configurations, or teach commands.

## VLAN colors, unplug buttons and motion (November 18, 2026)

- **VLAN colors.** A VLAN number gets the next free color from a fixed 12-color palette the first time it appears (switch
  port PVID or tagged list, SVI, VM tag), stored in `meta.vlanColors` so colors never shuffle. Switch ports get a bar
  (striped for trunks), cables on a switch port take that port's VLAN color (trunks are striped), VMs get a colored edge,
  and endpoints get a VLAN pill from their access port or, failing that, the SVI subnet their address is in. A legend
  lists the VLANs with their SVI subnets; hovering one fades everything outside it. Colors come only from what the team
  entered, never from the lab plan.
- **Unplug buttons.** Every port with a cable shows a small ×; selecting it removes that cable (Undo restores it).
- **Motion.** CSS only, off under prefers-reduced-motion, never in exports: a short fade-in on first load, a new cable
  draws itself in, and the cables of the selected device show traffic flowing.
