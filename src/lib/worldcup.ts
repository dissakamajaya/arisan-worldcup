export type TeamStatus = "alive" | "eliminated";

export type Country = {
  code: string;
  name: string;
  group: string;
  status: TeamStatus;
};

export type Match = {
  date: string;
  stage: string;
  label: string;
  venue: string;
};

export const MAX_PARTICIPANTS = 24;
export const COUNTRIES_PER_PARTICIPANT = 2;
export const ENTRY_FEE_IDR = 100000;

export const countries: Country[] = [
  { code: "MEX", name: "Mexico", group: "A", status: "alive" },
  { code: "RSA", name: "South Africa", group: "A", status: "alive" },
  { code: "KOR", name: "Korea Republic", group: "A", status: "alive" },
  { code: "CZE", name: "Czechia", group: "A", status: "alive" },
  { code: "CAN", name: "Canada", group: "B", status: "alive" },
  { code: "BIH", name: "Bosnia and Herzegovina", group: "B", status: "alive" },
  { code: "QAT", name: "Qatar", group: "B", status: "alive" },
  { code: "SUI", name: "Switzerland", group: "B", status: "alive" },
  { code: "BRA", name: "Brazil", group: "C", status: "alive" },
  { code: "MAR", name: "Morocco", group: "C", status: "alive" },
  { code: "HAI", name: "Haiti", group: "C", status: "alive" },
  { code: "SCO", name: "Scotland", group: "C", status: "alive" },
  { code: "USA", name: "United States", group: "D", status: "alive" },
  { code: "PAR", name: "Paraguay", group: "D", status: "alive" },
  { code: "AUS", name: "Australia", group: "D", status: "alive" },
  { code: "TUR", name: "Turkiye", group: "D", status: "alive" },
  { code: "GER", name: "Germany", group: "E", status: "alive" },
  { code: "CUW", name: "Curacao", group: "E", status: "alive" },
  { code: "CIV", name: "Ivory Coast", group: "E", status: "alive" },
  { code: "ECU", name: "Ecuador", group: "E", status: "alive" },
  { code: "NED", name: "Netherlands", group: "F", status: "alive" },
  { code: "JPN", name: "Japan", group: "F", status: "alive" },
  { code: "SWE", name: "Sweden", group: "F", status: "alive" },
  { code: "TUN", name: "Tunisia", group: "F", status: "alive" },
  { code: "BEL", name: "Belgium", group: "G", status: "alive" },
  { code: "EGY", name: "Egypt", group: "G", status: "alive" },
  { code: "IRN", name: "Iran", group: "G", status: "alive" },
  { code: "NZL", name: "New Zealand", group: "G", status: "alive" },
  { code: "ESP", name: "Spain", group: "H", status: "alive" },
  { code: "CPV", name: "Cape Verde", group: "H", status: "alive" },
  { code: "KSA", name: "Saudi Arabia", group: "H", status: "alive" },
  { code: "URU", name: "Uruguay", group: "H", status: "alive" },
  { code: "FRA", name: "France", group: "I", status: "alive" },
  { code: "SEN", name: "Senegal", group: "I", status: "alive" },
  { code: "IRQ", name: "Iraq", group: "I", status: "alive" },
  { code: "NOR", name: "Norway", group: "I", status: "alive" },
  { code: "ARG", name: "Argentina", group: "J", status: "alive" },
  { code: "ALG", name: "Algeria", group: "J", status: "alive" },
  { code: "AUT", name: "Austria", group: "J", status: "alive" },
  { code: "JOR", name: "Jordan", group: "J", status: "alive" },
  { code: "POR", name: "Portugal", group: "K", status: "alive" },
  { code: "COD", name: "DR Congo", group: "K", status: "alive" },
  { code: "UZB", name: "Uzbekistan", group: "K", status: "alive" },
  { code: "COL", name: "Colombia", group: "K", status: "alive" },
  { code: "ENG", name: "England", group: "L", status: "alive" },
  { code: "CRO", name: "Croatia", group: "L", status: "alive" },
  { code: "GHA", name: "Ghana", group: "L", status: "alive" },
  { code: "PAN", name: "Panama", group: "L", status: "alive" },
];

export const groupOrder = "ABCDEFGHIJKL".split("");

export const matches: Match[] = [
  { date: "Jun 11", stage: "Group", label: "Mexico vs South Africa", venue: "Mexico City Stadium" },
  { date: "Jun 11", stage: "Group", label: "Korea Republic vs Czechia", venue: "Estadio Guadalajara" },
  { date: "Jun 12", stage: "Group", label: "Canada vs Bosnia and Herzegovina", venue: "Toronto Stadium" },
  { date: "Jun 12", stage: "Group", label: "United States vs Paraguay", venue: "Los Angeles Stadium" },
  { date: "Jun 13", stage: "Group", label: "Qatar vs Switzerland", venue: "San Francisco Bay Area Stadium" },
  { date: "Jun 13", stage: "Group", label: "Brazil vs Morocco", venue: "New York New Jersey Stadium" },
  { date: "Jun 13", stage: "Group", label: "Haiti vs Scotland", venue: "Boston Stadium" },
  { date: "Jun 13", stage: "Group", label: "Australia vs Turkiye", venue: "BC Place" },
  { date: "Jun 14", stage: "Group", label: "Germany vs Curacao", venue: "Houston Stadium" },
  { date: "Jun 14", stage: "Group", label: "Netherlands vs Japan", venue: "Dallas Stadium" },
  { date: "Jun 14", stage: "Group", label: "Ivory Coast vs Ecuador", venue: "Philadelphia Stadium" },
  { date: "Jun 14", stage: "Group", label: "Sweden vs Tunisia", venue: "Estadio Monterrey" },
  { date: "Jun 15", stage: "Group", label: "Spain vs Cape Verde", venue: "Atlanta Stadium" },
  { date: "Jun 15", stage: "Group", label: "Belgium vs Egypt", venue: "BC Place" },
  { date: "Jun 15", stage: "Group", label: "Saudi Arabia vs Uruguay", venue: "Miami Stadium" },
  { date: "Jun 15", stage: "Group", label: "Iran vs New Zealand", venue: "Los Angeles Stadium" },
  { date: "Jun 16", stage: "Group", label: "France vs Senegal", venue: "New York New Jersey Stadium" },
  { date: "Jun 16", stage: "Group", label: "Iraq vs Norway", venue: "Boston Stadium" },
  { date: "Jun 16", stage: "Group", label: "Argentina vs Algeria", venue: "Kansas City Stadium" },
  { date: "Jun 16", stage: "Group", label: "Austria vs Jordan", venue: "San Francisco Bay Area Stadium" },
  { date: "Jun 17", stage: "Group", label: "Portugal vs DR Congo", venue: "Houston Stadium" },
  { date: "Jun 17", stage: "Group", label: "England vs Croatia", venue: "Dallas Stadium" },
  { date: "Jun 17", stage: "Group", label: "Ghana vs Panama", venue: "Toronto Stadium" },
  { date: "Jun 17", stage: "Group", label: "Uzbekistan vs Colombia", venue: "Mexico City Stadium" },
  { date: "Jun 18", stage: "Group", label: "Czechia vs South Africa", venue: "Atlanta Stadium" },
  { date: "Jun 18", stage: "Group", label: "Switzerland vs Bosnia and Herzegovina", venue: "Los Angeles Stadium" },
  { date: "Jun 18", stage: "Group", label: "Canada vs Qatar", venue: "BC Place" },
  { date: "Jun 18", stage: "Group", label: "Mexico vs Korea Republic", venue: "Estadio Guadalajara" },
  { date: "Jun 19", stage: "Group", label: "Scotland vs Morocco", venue: "Boston Stadium" },
  { date: "Jun 19", stage: "Group", label: "United States vs Australia", venue: "Seattle Stadium" },
  { date: "Jun 19", stage: "Group", label: "Brazil vs Haiti", venue: "Philadelphia Stadium" },
  { date: "Jun 19", stage: "Group", label: "Turkiye vs Paraguay", venue: "San Francisco Bay Area Stadium" },
  { date: "Jun 20", stage: "Group", label: "Netherlands vs Sweden", venue: "Houston Stadium" },
  { date: "Jun 20", stage: "Group", label: "Germany vs Ivory Coast", venue: "Toronto Stadium" },
  { date: "Jun 20", stage: "Group", label: "Ecuador vs Curacao", venue: "Kansas City Stadium" },
  { date: "Jun 20", stage: "Group", label: "Tunisia vs Japan", venue: "Estadio Monterrey" },
  { date: "Jun 21", stage: "Group", label: "Spain vs Saudi Arabia", venue: "Atlanta Stadium" },
  { date: "Jun 21", stage: "Group", label: "Belgium vs Iran", venue: "Los Angeles Stadium" },
  { date: "Jun 21", stage: "Group", label: "Uruguay vs Cape Verde", venue: "Miami Stadium" },
  { date: "Jun 21", stage: "Group", label: "New Zealand vs Egypt", venue: "BC Place" },
  { date: "Jun 22", stage: "Group", label: "Argentina vs Austria", venue: "Dallas Stadium" },
  { date: "Jun 22", stage: "Group", label: "France vs Iraq", venue: "Philadelphia Stadium" },
  { date: "Jun 22", stage: "Group", label: "Norway vs Senegal", venue: "New York New Jersey Stadium" },
  { date: "Jun 22", stage: "Group", label: "Jordan vs Algeria", venue: "San Francisco Bay Area Stadium" },
  { date: "Jun 23", stage: "Group", label: "Portugal vs Uzbekistan", venue: "Houston Stadium" },
  { date: "Jun 23", stage: "Group", label: "England vs Ghana", venue: "Boston Stadium" },
  { date: "Jun 23", stage: "Group", label: "Panama vs Croatia", venue: "Toronto Stadium" },
  { date: "Jun 23", stage: "Group", label: "Colombia vs DR Congo", venue: "Estadio Guadalajara" },
  { date: "Jun 24", stage: "Group", label: "Switzerland vs Canada", venue: "BC Place" },
  { date: "Jun 24", stage: "Group", label: "Bosnia and Herzegovina vs Qatar", venue: "Seattle Stadium" },
  { date: "Jun 24", stage: "Group", label: "Scotland vs Brazil", venue: "Miami Stadium" },
  { date: "Jun 24", stage: "Group", label: "Morocco vs Haiti", venue: "Atlanta Stadium" },
  { date: "Jun 24", stage: "Group", label: "Czechia vs Mexico", venue: "Mexico City Stadium" },
  { date: "Jun 24", stage: "Group", label: "South Africa vs Korea Republic", venue: "Estadio Monterrey" },
  { date: "Jun 25", stage: "Group", label: "Ecuador vs Germany", venue: "New York New Jersey Stadium" },
  { date: "Jun 25", stage: "Group", label: "Curacao vs Ivory Coast", venue: "Philadelphia Stadium" },
  { date: "Jun 25", stage: "Group", label: "Japan vs Sweden", venue: "Dallas Stadium" },
  { date: "Jun 25", stage: "Group", label: "Tunisia vs Netherlands", venue: "Kansas City Stadium" },
  { date: "Jun 25", stage: "Group", label: "Turkiye vs United States", venue: "Los Angeles Stadium" },
  { date: "Jun 25", stage: "Group", label: "Paraguay vs Australia", venue: "San Francisco Bay Area Stadium" },
  { date: "Jun 26", stage: "Group", label: "Norway vs France", venue: "Boston Stadium" },
  { date: "Jun 26", stage: "Group", label: "Senegal vs Iraq", venue: "Toronto Stadium" },
  { date: "Jun 26", stage: "Group", label: "Cape Verde vs Saudi Arabia", venue: "Houston Stadium" },
  { date: "Jun 26", stage: "Group", label: "Uruguay vs Spain", venue: "Estadio Guadalajara" },
  { date: "Jun 26", stage: "Group", label: "Egypt vs Iran", venue: "Seattle Stadium" },
  { date: "Jun 26", stage: "Group", label: "New Zealand vs Belgium", venue: "BC Place" },
  { date: "Jun 27", stage: "Group", label: "Panama vs England", venue: "New York New Jersey Stadium" },
  { date: "Jun 27", stage: "Group", label: "Croatia vs Ghana", venue: "Philadelphia Stadium" },
  { date: "Jun 27", stage: "Group", label: "Colombia vs Portugal", venue: "Miami Stadium" },
  { date: "Jun 27", stage: "Group", label: "DR Congo vs Uzbekistan", venue: "Atlanta Stadium" },
  { date: "Jun 27", stage: "Group", label: "Algeria vs Austria", venue: "Kansas City Stadium" },
  { date: "Jun 27", stage: "Group", label: "Jordan vs Argentina", venue: "Dallas Stadium" },
  { date: "Jun 28 - Jul 3", stage: "Round of 32", label: "16 knockout matches", venue: "US, Canada, Mexico" },
  { date: "Jul 4 - Jul 7", stage: "Round of 16", label: "8 knockout matches", venue: "US, Canada, Mexico" },
  { date: "Jul 9 - Jul 11", stage: "Quarterfinals", label: "4 quarterfinal matches", venue: "Boston, Los Angeles, Miami, Kansas City" },
  { date: "Jul 14 - Jul 15", stage: "Semifinals", label: "2 semifinal matches", venue: "Dallas and Atlanta" },
  { date: "Jul 18", stage: "Third place", label: "Bronze medal match", venue: "Miami Stadium" },
  { date: "Jul 19", stage: "Final", label: "World Cup Final", venue: "New York New Jersey Stadium" },
];

export function groupedCountries() {
  return groupOrder.map((group) => ({
    group,
    countries: countries.filter((country) => country.group === group),
  }));
}

export function countryByCode(code: string) {
  return countries.find((country) => country.code === code);
}
