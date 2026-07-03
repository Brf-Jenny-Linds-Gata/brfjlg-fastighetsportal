export type UhTyp = "komponent" | "löpande_buffert";
export type UhStatus = "godkänd" | "föreslagen" | "avvisad";

export type UhPost = {
  id: string;
  fastighet_id: string | null;
  fastighet_namn: string | null;
  kategori_id: string | null;
  kategori_namn: string | null;
  lage: string | null;
  namn: string;
  ar: number;
  investering: number;
  underhall: number;
  typ: UhTyp;
  status: UhStatus;
  genomford_datum: string | null;
  aterkommande_intervall_ar: number | null;
};

export type SbaOmfattning = "alla" | "spetshandsken" | "tumvanten";
export type SbaKontrollStatus = "pågående" | "klar";
export type AnmarkningStatus = "öppen" | "åtgärdad";

export type SbaKontroll = {
  id: string;
  fastighet_id: string;
  fastighet_namn: string;
  kvartal: number;
  ar: number;
  utford_av: string | null;
  utford_datum: string | null;
  status: SbaKontrollStatus;
};

export type SbaKontrollpunkt = {
  id: string;
  text: string;
  galler_fastighet: SbaOmfattning;
  ordning: number;
};

export type SbaKontrollResultat = {
  id: string;
  kontroll_id: string;
  punkt_id: string;
  godkand: boolean | null;
};

export type SbaAnmarkning = {
  id: string;
  kontroll_id: string;
  punkt_id: string | null;
  port_id: string | null;
  beskrivning: string;
  foto_url: string | null;
  status: AnmarkningStatus;
  atgardad_av: string | null;
  atgardad_datum: string | null;
  atgardskommentar: string | null;
  skapad_at: string;
};
