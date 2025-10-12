from functools import cache
from bidict import bidict
import bisect


def increment_letters(text: str) -> str:
    result = []
    for ch in text:
        if 'a' <= ch <= 'z':
            # wrap around at 'z'
            result.append(chr((ord(ch) - ord('a') + 1) % 26 + ord('a')))
        elif 'A' <= ch <= 'Z':
            # wrap around at 'Z'
            result.append(chr((ord(ch) - ord('A') + 1) % 26 + ord('A')))
        else:
            # keep non-letters as is
            result.append(ch)
    return ''.join(result)


chars: bidict[int, str] = bidict()

for i in range(26):
    chars[i] = chr(97 + i)
for i in range(26, 52):
    chars[i] = chr(39 + i)
chars[52] = '_'
for i in range(53, 62):
    chars[i] = chr(i - 4)
chars[62] = '0'

ident_reserved = {
    'do',
    'if',
    'for',
    'int',
    'auto',
    'bool',
    'case',
    'char',
    'else',
    'enum',
    'goto',
    'long',
    'true',
    'void',
    'break',
    'const',
    'false',
    'float',
    'short',
    'union',
    'while',
    'double',
    'extern',
    'inline',
    'return',
    'signed',
    'sizeof',
    'static',
    'struct',
    'switch',
    'typeof',
    'alignas',
    'alignof',
    'default',
    'nullptr',
    'typedef',
    'continue',
    'register',
    'restrict',
    'unsigned',
    'volatile',
    'constexpr',
    'thread_local',
    'static_assert',
    'typeof_unqual',
}

# list of discovered reserved i values, sorted ascendingly
reserved_i = []


"""
reserved: 100,150,200

i -> actual
99 -> 99
100 -> 101 : discover 100 -> add 100, skip 1
101 -> 102 : skip 1
149 -> 151 : discover 150 -> add 150, skip 2,
150 -> 152 : skip 2
"""


class Ident:
    def __init__(self, value: str):
        self.value = value

    def __str__(self):
        return self.value

    def __repr__(self):
        # return f"Ident('{self.value}')"
        return self.value

    def __len__(self):
        return len(self.value)

    def __lt__(self, other: 'Ident | str') -> bool:
        a, b = self._sorting_coefs(other)
        return a < b

    def __le__(self, other: 'Ident | str') -> bool:
        a, b = self._sorting_coefs(other)
        return a <= b

    def __gt__(self, other: 'Ident | str') -> bool:
        a, b = self._sorting_coefs(other)
        return a > b

    def __ge__(self, other: 'Ident | str') -> bool:
        a, b = self._sorting_coefs(other)
        return a >= b

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Ident):
            return self.value == other.value
        return self.value == other

    def __hash__(self) -> int:
        return hash(self.value)

    def _sorting_coefs(self, other: 'Ident | str') -> tuple[int, int]:
        other = other.value if isinstance(other, Ident) else other
        l = len(self.value)
        if self.value == other:
            return 0, 0
        if l != len(other) or not other:
            return len(self.value), len(other)

        i = 0
        while i < l and self.value[i] == other[i]:
            i += 1
        return chars.inverse[self.value[i]], chars.inverse[other[i]]


@cache
def ident(i: int) -> Ident:
    skip = bisect.bisect_right(reserved_i, i)
    i += skip

    F = 52  # letters
    B = 63  # letters + undersocre + digits
    """Return the shortest identifier for index i (0-based).
       First character is never a digit."""
    if i < 0:
        raise ValueError("i must be >= 0")

    # find length L such that i falls into the block of strings of length L
    # count(L) = F * B^(L-1)
    L = 1
    rem = i
    while True:
        count_L = F * (B ** (L - 1))
        if rem < count_L:
            break
        rem -= count_L
        L += 1

    if L == 1:
        return Ident(chars[rem])           # single-char
    # L >= 2: decompose rem into first index and (L-1)-digit base-B number
    first_idx, rest = divmod(rem, B ** (L - 1))

    # build (L-1) digits in base B, padded (most significant first)
    digits = []
    for pos in range(L - 1):
        power = B ** (L - 2 - pos)
        d = rest // power
        rest %= power
        digits.append(chars[d])

    s = Ident(chars[first_idx] + ''.join(digits))
    if s in ident_reserved:
        i -= skip
        bisect.insort(reserved_i, i)
        s = ident(i)
    return s


def ident_len(i: int) -> int:
    return len(ident(i))
