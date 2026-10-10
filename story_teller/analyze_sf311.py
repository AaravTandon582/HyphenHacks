
"""Analyze a San Francisco 311 sample and create a data-based story."""

import pandas as pd


def analyze_sf311(csv_path="sf311_sample.csv"):
    # 1. Read the CSV file.
    df = pd.read_csv(csv_path)

    # 2. Clean neighborhood names that are missing.
    neighborhoods = df["analysis_neighborhood"].fillna("Unknown")

    # 3. Count requests in each neighborhood.
    counts = neighborhoods.value_counts()

    # 4. Calculate statistics from the actual sample.
    result = {
        "total_requests": len(df),
        "neighborhood_count": len(counts),
        "average_requests": float(counts.mean()),
        "minimum_requests": int(counts.min()),
        "maximum_requests": int(counts.max()),
        "top_neighborhood": str(counts.idxmax()),
        "top_neighborhood_requests": int(counts.max()),
    }

    return result


def create_story(stats):
    """Explain the calculated results without guessing causes."""
    return (
        f"In this sample of {stats['total_requests']} San Francisco "
        f"311 requests, {stats['top_neighborhood']} has the highest "
        f"recorded count, with {stats['top_neighborhood_requests']} "
        f"requests. Across {stats['neighborhood_count']} represented "
        f"neighborhoods, the average is "
        f"{stats['average_requests']:.1f} requests per neighborhood. "
        "These results describe this sample and do not prove why "
        "the differences exist."
    )


if __name__ == "__main__":
    stats = analyze_sf311()

    print("\n--- SF 311 DATA ANALYSIS ---")
    for name, value in stats.items():
        print(f"{name}: {value}")

    print("\n--- CONSTELLATION STORY ---")
    print("Title: The Signal of the Mission")
    print("Story:", create_story(stats))