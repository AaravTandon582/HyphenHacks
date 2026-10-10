# Constellation — Dataset Documentation

## Dataset 1: San Francisco 311 Requests

* **File:** `sf311_sample.csv`
* **Source:** San Francisco Open Data
* **Dataset:** San Francisco 311 service requests
* **Sample size:** 1,000 records
* **Useful fields:** `service_name`, `analysis_neighborhood`, `lat`, `long`
* **Purpose:** Explore how recorded 311 requests are distributed across San Francisco neighborhoods.
* **Analysis script:** `analyze_sf311.py`
* **Generated story theme:** “The Signal of the Mission”

**Limitations:** This is a sample of requests, not a complete measure of neighborhood conditions. Request counts alone do not establish why differences exist.

## Dataset 2: EPA Daily Air Quality Index

* **File:** `bay_area_aqi_2025.zip`
* **Source:** U.S. Environmental Protection Agency (EPA)
* **Download:** https://aqs.epa.gov/aqsweb/airdata/daily_aqi_by_cbsa_2025.zip
* **Original dataset:** Daily AQI by metropolitan statistical area for 2025
* **Original size:** 170,306 records
* **Selected sample:** 1,546 daily records across 5 matched metropolitan areas
* **Useful fields:** `CBSA`, `Date`, `AQI`, `Category`, `Defining Parameter`, `Number of Sites Reporting`
* **Analysis script:** `analyze_aqi.py`
* **Generated sample file:** `bay_area_aqi_sample.csv`
* **Generated story theme:** “The Breath of the Bay”

**Limitations:** The analysis covers only selected metropolitan areas and available daily records. AQI values can vary by date and location. The highest daily value does not represent the annual average.

## How the Story Teller Uses Data

1. Python analyzes real dataset values.
2. The analysis produces numerical statistics.
3. The Story Teller converts those statistics into a short, understandable explanation.
4. If AI is unavailable, prewritten fallback stories can keep the feature working.
5. Stories must not invent statistics or claim that the data proves a cause.

## Responsible Data Use

Constellation should distinguish measured facts from interpretations. Every story should describe the dataset and its limitations accurately.
    