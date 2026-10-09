
# Commut.ph — Product Requirements Document (PRD)

## 1. Summary
Commut.ph is a public transportation fare lookup application designed to help Filipino commuters quickly determine estimated fares for their trips. Unlike navigation-focused applications such as Sakay.ph, Commut.ph prioritizes **accurate, time-relevant fare information** for public transportation, starting with Metro Manila jeepneys and buses.

The application will use an internally maintained fare database based on official LTFRB fare matrices and applicable fare rules. Mapping and routing APIs may support distance estimation where needed.

## 2. Goals
- Provide commuters with reliable, up-to-date fare estimates.
- Reduce uncertainty about transportation costs before and during trips.
- Support fare calculations based on route, distance, transport type, and applicable passenger discounts.
- Establish a maintainable fare database that can be updated when official rates change.
- Launch an MVP focused on Metro Manila jeepneys and buses.

## 3. Target Users
- **Daily commuters:** Students and employees who regularly use public transportation.
- **Occasional commuters:** People unfamiliar with specific routes or fare rates.
- **Budget-conscious travelers:** Passengers who need to estimate transportation expenses.
- **Students and senior citizens:** Commuters who need applicable discounted fare calculations.

## 4. User Acceptance Criteria (UAC)

### UAC 1: Fare Lookup
- Users can select a supported transport type and enter their origin and destination.
- The system returns an estimated fare when sufficient route and fare data are available.
- The result identifies the transport type and applicable fare basis.

### UAC 2: Fare Accuracy
- Calculations follow the latest verified official fare matrix and applicable rules.
- Regular and eligible discounted fares are calculated correctly.
- Estimates are clearly distinguished from operator-confirmed fares when exact route-specific pricing is unavailable.

### UAC 3: Fare Data Freshness
- Each fare dataset records its source, effective date, and last verification date.
- Updated official fare rules can be reflected without requiring an application release.
- Outdated or unverified data is flagged rather than presented as definitively current.

### UAC 4: Coverage and Error Handling
- The system clearly indicates when a route or transport type is unsupported.
- Missing data does not produce fabricated fare estimates.
- Users receive clear guidance when their selected trip cannot be calculated.

### UAC 5: Usability
- Users can obtain a fare estimate through a simple, mobile-friendly interface.
- Fare results are presented clearly, with discounts and assumptions explained.
- Users can correct their origin or destination and recalculate.

## 5. User Stories

| ID | User story | Priority |
|---|---|---|
| US-01 | As a commuter, I want to enter my origin and destination so I can estimate my transportation fare. | Must-have |
| US-02 | As a commuter, I want to select a transport type so I can get the appropriate fare estimate. | Must-have |
| US-03 | As a commuter, I want to see the fare breakdown and calculation basis so I understand how the estimate was derived. | Must-have |
| US-04 | As a student or eligible passenger, I want to calculate discounted fares so I can budget accurately. | Must-have |
| US-05 | As a commuter, I want to know when fare information was last verified so I can assess its reliability. | Must-have |
| US-06 | As a commuter, I want to know when a route is unsupported so I do not rely on an invented fare. | Must-have |
| US-07 | As a commuter, I want to compare regular and discounted fares so I can determine my expected travel cost. | Should-have |
| US-08 | As an administrator, I want to update fare matrices and their effective dates so the application reflects official fare changes. | Must-have |
| US-09 | As a commuter, I want to reuse or switch my selected locations easily so I can check multiple trips efficiently. | Should-have |

## Initial MVP Scope
**Included:** Metro Manila jeepney and bus fare estimates, origin/destination input, regular and applicable discounted fares, fare data provenance, and unsupported-route handling.

**Excluded initially:** Live vehicle tracking, turn-by-turn navigation, real-time congestion, user accounts, and nationwide transport coverage.

**Key dependency:** Reliable route coverage and verified fare rules. Google Maps or OpenStreetMap can assist with locations and routing, but the fare calculation must rely on validated fare rules and route-specific data rather than assuming a mapping API supplies every fare.# Commut.ph — Product Requirements Document (PRD)

## 1. Summary
Commut.ph is a public transportation fare lookup application designed to help Filipino commuters quickly determine estimated fares for their trips. Unlike navigation-focused applications such as Sakay.ph, Commut.ph prioritizes **accurate, time-relevant fare information** for public transportation, starting with Metro Manila jeepneys and buses.

The application will use an internally maintained fare database based on official LTFRB fare matrices and applicable fare rules. Mapping and routing APIs may support distance estimation where needed.

## 2. Goals
- Provide commuters with reliable, up-to-date fare estimates.
- Reduce uncertainty about transportation costs before and during trips.
- Support fare calculations based on route, distance, transport type, and applicable passenger discounts.
- Establish a maintainable fare database that can be updated when official rates change.
- Launch an MVP focused on Metro Manila jeepneys and buses.

## 3. Target Users
- **Daily commuters:** Students and employees who regularly use public transportation.
- **Occasional commuters:** People unfamiliar with specific routes or fare rates.
- **Budget-conscious travelers:** Passengers who need to estimate transportation expenses.
- **Students and senior citizens:** Commuters who need applicable discounted fare calculations.

## 4. User Acceptance Criteria (UAC)

### UAC 1: Fare Lookup
- Users can select a supported transport type and enter their origin and destination.
- The system returns an estimated fare when sufficient route and fare data are available.
- The result identifies the transport type and applicable fare basis.

### UAC 2: Fare Accuracy
- Calculations follow the latest verified official fare matrix and applicable rules.
- Regular and eligible discounted fares are calculated correctly.
- Estimates are clearly distinguished from operator-confirmed fares when exact route-specific pricing is unavailable.

### UAC 3: Fare Data Freshness
- Each fare dataset records its source, effective date, and last verification date.
- Updated official fare rules can be reflected without requiring an application release.
- Outdated or unverified data is flagged rather than presented as definitively current.

### UAC 4: Coverage and Error Handling
- The system clearly indicates when a route or transport type is unsupported.
- Missing data does not produce fabricated fare estimates.
- Users receive clear guidance when their selected trip cannot be calculated.

### UAC 5: Usability
- Users can obtain a fare estimate through a simple, mobile-friendly interface.
- Fare results are presented clearly, with discounts and assumptions explained.
- Users can correct their origin or destination and recalculate.

## 5. User Stories

| ID | User story | Priority |
|---|---|---|
| US-01 | As a commuter, I want to enter my origin and destination so I can estimate my transportation fare. | Must-have |
| US-02 | As a commuter, I want to select a transport type so I can get the appropriate fare estimate. | Must-have |
| US-03 | As a commuter, I want to see the fare breakdown and calculation basis so I understand how the estimate was derived. | Must-have |
| US-04 | As a student or eligible passenger, I want to calculate discounted fares so I can budget accurately. | Must-have |
| US-05 | As a commuter, I want to know when fare information was last verified so I can assess its reliability. | Must-have |
| US-06 | As a commuter, I want to know when a route is unsupported so I do not rely on an invented fare. | Must-have |
| US-07 | As a commuter, I want to compare regular and discounted fares so I can determine my expected travel cost. | Should-have |
| US-08 | As an administrator, I want to update fare matrices and their effective dates so the application reflects official fare changes. | Must-have |
| US-09 | As a commuter, I want to reuse or switch my selected locations easily so I can check multiple trips efficiently. | Should-have |

## Initial MVP Scope
**Included:** Metro Manila jeepney and bus fare estimates, origin/destination input, regular and applicable discounted fares, fare data provenance, and unsupported-route handling.

**Excluded initially:** Live vehicle tracking, turn-by-turn navigation, real-time congestion, user accounts, and nationwide transport coverage.

**Key dependency:** Reliable route coverage and verified fare rules. Google Maps or OpenStreetMap can assist with locations and routing, but the fare calculation must rely on validated fare rules and route-specific data rather than assuming a mapping API supplies every fare.