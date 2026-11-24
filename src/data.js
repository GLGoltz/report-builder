// ------------------------------------------------------------------ course data
// Only what the course pages already show students. No answers, no expected values (spec section 2).
// LABS is generated from the course pages by tools/labs.py and injected by build.mjs.
const LABS = /*LABS*/[];

// Cyber Hub 15: what goes back in the Utility Drawer. A placeholder until Gabriel confirms the real contents.
// Keep it the same as the "Utility drawer contents" table on Reference: The Rack (cyber-hub pages_ref.py).
const DRAWER = ["Console cable (blue)", "Multiport dongle", "KVM cable", "USB Stick A", "USB Stick B",
  "Raspberry Pi 3B (VULN-PI), with its SD card"];
// Cyber Hub 15: every device the team resets, and the reset the page asks for.
const RESETS = [
  ["Core switch", "Factory defaults"], ["FortiWiFi 60E", "Factory defaults"],
  ["Proxmox host", "Every VM deleted, including the scanner"], ["R440 server", "BIOS factory defaults loaded"],
  ["USB Stick A", "Re-flashed with the Proxmox installer"], ["USB Stick B", "Firewall backups deleted"],
  ["NAS", "Mode 2 reset"], ["Vulnerable Pi", "SD card re-flashed from repo.lab"],
  ["Team laptops", "Lab route removed and guest Wi-Fi forgotten"],
];

// Deliverables that are their own document, keyed "hub-n".
const SEPARATE = {
  "00-1": ["cover", "Your cover page and team agreement, at the front of this log. They export with Cyber Hub 00."],
  "11-2": ["none", "Don't put the answer key in this app or anywhere the other team might see it. Submit it privately to the instructor."],
  "12-5": ["var", "The VAR is its own document, in the VAR tab. Submit it separately and give the client a copy."],
  "13-2": ["ssp", "The SSP is its own document, in the SSP tab. Submit it separately."],
  "14-1": ["link", "Paste the link to your slides."],
  "15-3": ["restore", "Your restoration record is above, in this section, with the instructor's sign-off. It exports with Cyber Hub 15."],
};

const CHECKPOINT_05 = [
  ["Your own address", "In the Data pool"], ["Ping the Data gateway", "Replies"], ["Ping the Management gateway", "Replies"],
  ["Ping the firewall's internal address", "Replies"], ["Open the firewall's login page", "Loads"],
  ["Ping the provider's gateway, then 203.0.113.10", "Replies"],
];

const CONTROLS = [
  ["AC-4", "Information flow enforcement", "Traffic between networks is allowed only where the company needs it.", "Name the firewall policies and what each allows. Explain why the DMZ can't start connections to the internal network."],
  ["AC-17", "Remote access", "Devices are managed only from approved networks, over approved methods.", "Where can each device be managed from? Mention the Management VLAN and the out-of-band port."],
  ["IA-5", "Authenticator management", "Accounts are protected by passwords that are controlled and changed when needed.", "Which accounts exist on each device, and how are passwords handled?"],
  ["SC-7", "Boundary protection", "Public-facing systems are separated from internal systems.", "Describe the DMZ, the guest network and the port forwards (VIPs)."],
  ["SC-8", "Transmission confidentiality", "Logins and sensitive data are encrypted in transit.", "Which management and file transfer protocols are on and off?"],
  ["CM-2", "Baseline configuration", "A known-good configuration is recorded and can be restored.", "Where are the firewall backup and the switch's startup configuration kept?"],
  ["CM-7", "Least functionality", "Only needed ports and services are enabled.", "Unused switch ports, disabled services, anything removed after the assessment."],
  ["AU-2", "Event logging", "Security-relevant events are logged.", "Which firewall policies log traffic, and where would you look during an incident?"],
  ["RA-5", "Vulnerability scanning", "Systems are scanned for weaknesses and results are acted on.", "Your scanner, the baseline scan, the outside assessment and the re-scan."],
  ["SI-2", "Flaw remediation", "Known weaknesses are fixed and the fixes are verified.", "What you fixed after the VAR and how the re-scan proved it."],
  ["CP-9", "System backup", "Data and configurations can be recovered after a failure.", "The NAS RAID level and what it protects against, plus configuration backups."],
  ["PE-3", "Physical access control", "Physical access to equipment is controlled.", "Who can reach the rack and its ports? Link to your physical security briefing."],
];
const CONTROL_STATUS = ["Implemented", "Partial", "Planned", "Accepted risk"];

const CVSS_METRICS = [
  ["AV", "Attack vector", [["N", "Network"], ["A", "Adjacent"], ["L", "Local"], ["P", "Physical"]]],
  ["AC", "Attack complexity", [["L", "Low"], ["H", "High"]]],
  ["PR", "Privileges required", [["N", "None"], ["L", "Low"], ["H", "High"]]],
  ["UI", "User interaction", [["N", "None"], ["R", "Required"]]],
  ["S", "Scope", [["U", "Unchanged"], ["C", "Changed"]]],
  ["C", "Confidentiality", [["N", "None"], ["L", "Low"], ["H", "High"]]],
  ["I", "Integrity", [["N", "None"], ["L", "Low"], ["H", "High"]]],
  ["A", "Availability", [["N", "None"], ["L", "Low"], ["H", "High"]]],
];
const VALIDATION = [["confirmed", "Confirmed"], ["not-verified", "Not verified"], ["false-positive", "False positive"]];
const VIEWS = [["internal", "Internal"], ["external", "External"], ["both", "Both"]];
const EFFORT = ["Low", "Medium", "High"];
// How the system owner responds to each POA&M weakness (NIST risk responses, as the SSP uses them).
const RESPONSES = ["", "Remediate", "Mitigate", "Accept risk"];
