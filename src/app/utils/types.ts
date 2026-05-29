export interface SnsUrls {
  instagram?: string; // e.g. "https://instagram.com/ayari"
  x?: string;         // e.g. "https://x.com/ayari_x"
  github?: string;    // e.g. "https://github.com/ayari_git"
  discord?: string;   // e.g. "https://discordapp.com/users/..."
  custom?: string;    // e.g. "https://my-portfolio.com"
}

export interface Registration {
  id: string;
  name: string;
  affiliation: string;
  snsUrls: SnsUrls;
  checkedInAt: string;
  printStatus: "pending" | "printed";
  printedAt?: string;
}
