use std::collections::HashMap;

pub struct OuiDb {
	by_prefix: HashMap<String, String>,
}

impl OuiDb {
	pub fn new_embedded() -> Self {
		let csv = include_str!("../assets/oui.csv");
		let mut by_prefix = HashMap::new();
		for (idx, line) in csv.lines().enumerate() {
			if idx == 0 { continue; }
			let parts: Vec<&str> = line.split(',').collect();
			if parts.len() < 3 { continue; }
			let assignment = parts[1].trim();
			let org = parts[2].trim().to_string();
			let prefix = assignment.replace('-', ":").to_lowercase();
			by_prefix.insert(prefix, org);
		}
		Self { by_prefix }
	}

	pub fn lookup(&self, mac: &str) -> Option<&str> {
		let mac = mac.to_lowercase();
		// MA-L (first 3 bytes): 00:11:22
		let pref3 = mac.get(0..8);
		if let Some(p) = pref3.and_then(|p| self.by_prefix.get(p)) {
			return Some(p.as_str());
		}
		None
	}
}
