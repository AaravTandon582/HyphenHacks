
"""Analyze EPA daily Air Quality Index data for Bay Area metro areas."""

import pandas as pd


def analyze_aqi(csv_path="bay_area_aqi_2025.zip"):
    df = pd.read_csv(csv_path)

    bay_area_names = (
        "San Francisco|San Jose|Santa Cruz|Napa|Santa Rosa|Vallejo"
    )

    bay_area = df[
        df["CBSA"].str.contains(
            bay_area_names, case=False, na=False
        )
    ].copy()

    # Convert AQI to numbers and ignore missing values.
    bay_area["AQI"] = pd.to_numeric(
        bay_area["AQI"], errors="coerce"
    )
    bay_area = bay_area.dropna(subset=["AQI"])

    # Save a smaller dataset for the project.
    bay_area.to_csv("bay_area_aqi_sample.csv", index=False)

    stats = {
        "daily_records": len(bay_area),
        "metro_areas": bay_area["CBSA"].nunique(),
        "average_aqi": round(float(bay_area["AQI"].mean()), 1),
        "minimum_aqi": int(bay_area["AQI"].min()),
        "maximum_aqi": int(bay_area["AQI"].max()),
        "highest_aqi_metro": bay_area.loc[
            bay_area["AQI"].idxmax(), "CBSA"
        ],
        "highest_aqi": int(bay_area["AQI"].max()),
    }

    return stats


def create_story(stats):
    return (
        f"In this EPA dataset, {stats['metro_areas']} Bay Area "
        f"metro areas have {stats['daily_records']} daily records. "
        f"The average recorded AQI is {stats['average_aqi']}. "
        f"The highest daily AQI in the selected records is "
        f"{stats['highest_aqi']} in {stats['highest_aqi_metro']}. "
        "These figures describe the selected records and do not "
        "by themselves explain the causes of air quality differences."
    )


if __name__ == "__main__":
    stats = analyze_aqi()

    print("\n--- BAY AREA AQI ANALYSIS ---")
    for name, value in stats.items():
        print(f"{name}: {value}")

    print("\n--- CONSTELLATION STORY ---")
    print("Title: The Breath of the Bay")
    print("Story:", create_story(stats))