from dataclasses import dataclass
import re


# Standard atomic weights; radioelements use a representative isotope mass number.
ELEMENTS = {
    "H": (1, 1.008), "He": (2, 4.002602), "Li": (3, 6.94), "Be": (4, 9.0121831),
    "B": (5, 10.81), "C": (6, 12.011), "N": (7, 14.007), "O": (8, 15.999),
    "F": (9, 18.998403163), "Ne": (10, 20.1797), "Na": (11, 22.98976928),
    "Mg": (12, 24.305), "Al": (13, 26.9815385), "Si": (14, 28.085),
    "P": (15, 30.973761998), "S": (16, 32.06), "Cl": (17, 35.45),
    "Ar": (18, 39.948), "K": (19, 39.0983), "Ca": (20, 40.078),
    "Sc": (21, 44.955908), "Ti": (22, 47.867), "V": (23, 50.9415),
    "Cr": (24, 51.9961), "Mn": (25, 54.938044), "Fe": (26, 55.845),
    "Co": (27, 58.933194), "Ni": (28, 58.6934), "Cu": (29, 63.546),
    "Zn": (30, 65.38), "Ga": (31, 69.723), "Ge": (32, 72.630),
    "As": (33, 74.921595), "Se": (34, 78.971), "Br": (35, 79.904),
    "Kr": (36, 83.798), "Rb": (37, 85.4678), "Sr": (38, 87.62),
    "Y": (39, 88.90584), "Zr": (40, 91.224), "Nb": (41, 92.90637),
    "Mo": (42, 95.95), "Tc": (43, 98), "Ru": (44, 101.07),
    "Rh": (45, 102.90550), "Pd": (46, 106.42), "Ag": (47, 107.8682),
    "Cd": (48, 112.414), "In": (49, 114.818), "Sn": (50, 118.710),
    "Sb": (51, 121.760), "Te": (52, 127.60), "I": (53, 126.90447),
    "Xe": (54, 131.293), "Cs": (55, 132.90545196), "Ba": (56, 137.327),
    "La": (57, 138.90547), "Ce": (58, 140.116), "Pr": (59, 140.90766),
    "Nd": (60, 144.242), "Pm": (61, 145), "Sm": (62, 150.36),
    "Eu": (63, 151.964), "Gd": (64, 157.25), "Tb": (65, 158.92535),
    "Dy": (66, 162.500), "Ho": (67, 164.93033), "Er": (68, 167.259),
    "Tm": (69, 168.93422), "Yb": (70, 173.045), "Lu": (71, 174.9668),
    "Hf": (72, 178.49), "Ta": (73, 180.94788), "W": (74, 183.84),
    "Re": (75, 186.207), "Os": (76, 190.23), "Ir": (77, 192.217),
    "Pt": (78, 195.084), "Au": (79, 196.966569), "Hg": (80, 200.592),
    "Tl": (81, 204.38), "Pb": (82, 207.2), "Bi": (83, 208.98040),
    "Po": (84, 209), "At": (85, 210), "Rn": (86, 222),
    "Fr": (87, 223), "Ra": (88, 226), "Ac": (89, 227),
    "Th": (90, 232.0377), "Pa": (91, 231.03588), "U": (92, 238.02891),
    "Np": (93, 237), "Pu": (94, 244), "Am": (95, 243),
    "Cm": (96, 247), "Bk": (97, 247), "Cf": (98, 251),
    "Es": (99, 252), "Fm": (100, 257), "Md": (101, 258),
    "No": (102, 259), "Lr": (103, 266), "Rf": (104, 267),
    "Db": (105, 268), "Sg": (106, 269), "Bh": (107, 270),
    "Hs": (108, 269), "Mt": (109, 278), "Ds": (110, 281),
    "Rg": (111, 282), "Cn": (112, 285), "Nh": (113, 286),
    "Fl": (114, 289), "Mc": (115, 290), "Lv": (116, 293),
    "Ts": (117, 294), "Og": (118, 294),
}

ISOTOPE_MASSES = {
    "1H": 1.007825,
    "2H": 2.014102,
    "12C": 12.0,
    "16O": 15.994915,
    "56Fe": 55.934937,
    "197Au": 196.966569,
    "205Au": 204.974,
    "208Pb": 207.9766525,
    "238U": 238.050788,
}

_NUCLIDE_RE = re.compile(r"^\s*(\d{1,3})?\s*([A-Za-z]{1,2})\s*$")
NEAR_TRANSMUTATION = 6


@dataclass(frozen=True)
class Nuclide:
    symbol: str
    z: int
    a: int
    molar_mass: float
    label: str
    canonical: str


def parse_nuclide(text):
    if text is None:
        return None
    match = _NUCLIDE_RE.fullmatch(str(text))
    if not match:
        return None

    mass_token, raw_symbol = match.groups()
    symbol = raw_symbol.capitalize()
    element = ELEMENTS.get(symbol)
    if element is None:
        return None

    z, weight = element
    if mass_token:
        a = int(mass_token)
        if not _plausible_isotope(z, a):
            return False
        molar_mass = ISOTOPE_MASSES.get(f"{a}{symbol}", float(a))
    else:
        a = int(round(weight))
        molar_mass = float(weight)

    label = str(text).strip()
    return Nuclide(
        symbol=symbol,
        z=z,
        a=a,
        molar_mass=molar_mass,
        label=label,
        canonical=f"{a}{symbol}",
    )


def _plausible_isotope(z, a):
    return z <= a <= min(295, max(3 * z + 20, z + 8))


def nuclear_distance(source, product):
    return abs(source.z - product.z) + abs(source.a - product.a)


def didactic_factor(source, product):
    distance = nuclear_distance(source, product)
    return NEAR_TRANSMUTATION / max(NEAR_TRANSMUTATION, distance)


def effective_probability(base_probability, source, product):
    value = base_probability * didactic_factor(source, product)
    return min(1.0, max(0.0, value))
