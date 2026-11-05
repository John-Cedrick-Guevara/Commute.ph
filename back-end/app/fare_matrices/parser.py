import io
import re
from decimal import Decimal

import pdfplumber

# A fare row: distance in km, then the regular and discounted fares, e.g. "5 16.00 12.75",
# "5 km  P16.00  P12.75" or "5 | ₱16.00 | ₱12.75". Anything after the two fares is ignored.
ROW = re.compile(
    r"^\s*(\d{1,3})(?!\d)\s*(?:km)?\s*[|:]?\s*(?:₱|PHP|P)?\s*(\d{1,4}(?:\.\d{1,2})?)\s*[|]?\s*"
    r"(?:₱|PHP|P)?\s*(\d{1,4}(?:\.\d{1,2})?)\b",
    re.IGNORECASE,
)


def parse_fare_rows(text: str) -> tuple[list[dict], list[str]]:
    """
    Pull (distance_km, regular_fare, discounted_fare) rows out of fare matrix text.
    No guessing beyond the line pattern: the admin reviews and edits every row before publishing.
    Returns the rows sorted by distance and warnings about anything skipped.
    """
    rows: dict[int, dict] = {}
    warnings: list[str] = []

    for line in text.splitlines():
        match = ROW.match(line)
        if not match:
            continue
        km, regular, discounted = int(match[1]), Decimal(match[2]), Decimal(match[3])
        if km in rows:
            warnings.append(f"{km} km appears more than once; kept the first ({rows[km]['regular_fare']}).")
            continue
        rows[km] = {"distance_km": km, "regular_fare": regular, "discounted_fare": discounted}

    if not rows:
        warnings.append("No fare rows were found in the PDF. Enter the rows by hand or paste them as CSV.")
    return [rows[km] for km in sorted(rows)], warnings


def parse_fare_pdf(data: bytes) -> tuple[list[dict], list[str]]:
    """Extract the text of every page of a fare matrix PDF and parse its rows."""
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as err:  # pdfminer raises many types for broken files
        return [], [f"The PDF could not be read ({type(err).__name__}). Enter the rows by hand or paste them as CSV."]

    if not text.strip():
        return [], ["The PDF has no text layer (it may be a scanned image). Enter the rows by hand or paste them as CSV."]
    return parse_fare_rows(text)
