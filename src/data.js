// ------------------------------------------------------------------ course data
// Only what the course pages already show students. No answers, no expected values (spec section 2).
// LABS is generated from the course pages by tools/labs.py and injected by build.mjs.
const LABS = /*LABS*/[];

const RACK_ROWS = [
  ["rack", "Rack number", "R"], ["wan", "Firewall WAN (wan1)", "10.R.200.2"], ["gw", "Provider gateway", "10.R.200.1"],
  ["dns", "Lab DNS and time server", "203.0.113.10"], ["fwint", "Firewall internal", "10.R.100.1"],
  ["fwdmz", "Firewall DMZ", "10.R.40.1"], ["fwguest", "Firewall guest Wi-Fi", "10.R.50.1"],
  ["svi", "Switch Transit SVI", "10.R.100.254"], ["mgmtgw", "Management gateway", "10.R.10.254"],
  ["datagw", "Data gateway", "10.R.20.254"], ["storgw", "Storage gateway", "10.R.30.254"],
  ["pve", "Proxmox host", "10.R.10.10"], ["nas", "NAS", "10.R.30.10"], ["web", "Web server VM", "10.R.40.10"],
  ["ftp", "FTP server VM", "10.R.40.11"], ["scan", "Scanner VM", "10.R.10.20"], ["pool", "Data DHCP pool", "10.R.20.100 to .199"],
];

// Deliverables that are their own document, keyed "hub-n".
const SEPARATE = {
  "00-1": ["cover", "Your cover page and team agreement, at the front of this log. They export with Cyber Hub 00."],
  "00-2": ["rack", "Your rack sheet, at the front of this log. It exports with Cyber Hub 00."],
  "11-2": ["none", "Don't put the answer key in this app or anywhere the other team might see it. Submit it privately to the instructor."],
  "12-5": ["var", "The VAR is its own document, in the VAR tab. Submit it separately and give the client a copy."],
  "13-2": ["ssp", "The SSP is its own document, in the SSP tab. Submit it separately."],
  "14-1": ["link", "Paste the link to your slides."],
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
