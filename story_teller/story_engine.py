
"""
Constellation — Story Teller Feature
File: story_engine.py

Turns cluster statistics into readable stories.
Uses GPT-4o-mini when available and offline backup stories
when AI generation fails.
"""

import json
import math
import os


# 1. BACKUP STORIES
# These templates work without Wi-Fi or an AI API.

FALLBACK_STORIES = {
    "high": {
        "title": "The Peak of Olympus",
        "story": (
            "This cluster has an average {feature} of {mean}, "
            "which is higher than the overall average of "
            "{overall_mean}. Its values range from {min} to {max}. "
            "This group stands out because its average measurement "
            "is relatively high compared with the overall dataset."
        ),
    },
    "low": {
        "title": "The Quiet Valley",
        "story": (
            "This cluster has an average {feature} of {mean}, "
            "which is lower than the overall average of "
            "{overall_mean}. Its values range from {min} to {max}. "
            "This group stands out because its average measurement "
            "is relatively low compared with the overall dataset."
        ),
    },
    "mixed": {
        "title": "The Constellation of Balance",
        "story": (
            "This cluster has an average {feature} of {mean}, "
            "compared with the overall average of {overall_mean}. "
            "Its values range from {min} to {max}. Based on its "
            "average, this group's measurement is relatively close "
            "to the overall average."
        ),
    },
}


# 2. VALIDATE THE STATISTICS

def validate_cluster(cluster):
    """Check that required statistics are valid numbers."""

    required_fields = ["mean", "min", "max", "overall_mean"]

    for field in required_fields:
        if field not in cluster:
            raise ValueError(f"Missing required field: {field}")

        value = cluster[field]

        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{field} must be a number.")

        if not math.isfinite(value):
            raise ValueError(f"{field} must be a finite number.")

    if cluster["min"] > cluster["max"]:
        raise ValueError("The minimum cannot be greater than the maximum.")

    if not cluster["min"] <= cluster["mean"] <= cluster["max"]:
        raise ValueError(
            "The mean should be between the minimum and maximum."
        )

    return cluster


def format_number(value):
    """Avoid unnecessary decimal places."""

    return f"{value:g}"


# 3. CLASSIFY THE CLUSTER

def classify_cluster(cluster):
    """
    Compare the cluster average with the overall average.

    The 20% threshold is a simple demo rule, not a universal
    statistical rule.
    """

    mean = cluster["mean"]
    overall_mean = cluster["overall_mean"]

    difference = mean - overall_mean
    threshold = 0.20 * abs(overall_mean)

    if difference > threshold:
        return "high"

    if difference < -threshold:
        return "low"

    return "mixed"


# 4. GENERATE A BACKUP STORY  

def generate_fallback_story(cluster):
    """Create a story using a prepared template."""

    validate_cluster(cluster)

    category = classify_cluster(cluster)
    template = FALLBACK_STORIES[category]

    values = {
        "feature": cluster.get("feature", "measurement"),
        "mean": format_number(cluster["mean"]),
        "min": format_number(cluster["min"]),
        "max": format_number(cluster["max"]),
        "overall_mean": format_number(cluster["overall_mean"]),
    }

    story = template["story"].format(**values)

    return {
        "cluster_id": cluster.get("cluster_id", "unknown"),
        "title": template["title"],
        "story": story,
        "source": "offline_fallback",
        "statistics": {
            "mean": cluster["mean"],
            "min": cluster["min"],
            "max": cluster["max"],
            "overall_mean": cluster["overall_mean"],
        },
    }


# 5. GENERATE A STORY

def generate_ai_story(cluster):
    """Ask GPT-4o-mini to write a story from supplied statistics."""

    validate_cluster(cluster)

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set.")

    from openai import OpenAI

    client = OpenAI(api_key=api_key)

    stats = {
        "feature": cluster.get("feature", "measurement"),
        "mean": cluster["mean"],
        "min": cluster["min"],
        "max": cluster["max"],
        "overall_mean": cluster["overall_mean"],
        "cluster_id": cluster.get("cluster_id", "unknown"),
        "count": cluster.get("count"),
    }

    prompt = f"""
You are the Story Teller for Constellation, a data exploration app.

Write:
1. A short, evocative mythological or astronomy-inspired title.
2. A clear story of 50–90 words in plain English.

Rules:
- Use only the supplied statistics.
- Never invent, estimate, or change measurements.
- Explain how the cluster average compares with the overall average.
- Describe the minimum and maximum when useful.
- Do not claim that one thing caused another.
- Do not invent explanations for why a pattern exists.
- Make the story understandable to a beginner.
- Return a JSON object with exactly two string fields:
  "title" and "story".
- Do not include Markdown or extra text outside the JSON.

Cluster statistics:
{json.dumps(stats, allow_nan=False)}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Explain data honestly and clearly. "
                    "Never invent facts or claim correlation proves causation."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
    )

    content = response.choices[0].message.content

    if not content:
        raise ValueError("The AI returned an empty response.")

    result = json.loads(content)

    title = result.get("title")
    story = result.get("story")

    if not isinstance(title, str) or not title.strip():
        raise ValueError("The AI response has no valid title.")

    if not isinstance(story, str) or not story.strip():
        raise ValueError("The AI response has no valid story.")

    return {
        "cluster_id": cluster.get("cluster_id", "unknown"),
        "title": title.strip(),
        "story": story.strip(),
        "source": "gpt-4o-mini",
        "statistics": {
            "mean": cluster["mean"],
            "min": cluster["min"],
            "max": cluster["max"],
            "overall_mean": cluster["overall_mean"],
        },
    }


# 6. MAIN FUNCTION: FIRST, BACKUP IF IT FAILS

def generate_story(cluster, use_ai=True):
    """Generate an AI story or safely fall back to a template."""

    validate_cluster(cluster)

    if use_ai:
        try:
            return generate_ai_story(cluster)
        except Exception as error:
            print(
                "AI story generation failed. "
                f"Using offline backup instead. Details: {error}"
            )

    return generate_fallback_story(cluster)


# 7. TEST THE STORY ENGINE

if __name__ == "__main__":
    # Sample numbers for testing only.
    # Replace these with real statistics from your team's analysis.

    demo_cluster = {
        "cluster_id": 1,
        "feature": "example measurement",
        "mean": 85,
        "min": 60,
        "max": 110,
        "overall_mean": 50,
        "count": 12,
    }

    # Set use_ai=False to test the offline backup first.
    story_result = generate_story(demo_cluster, use_ai=False)

    print("\n--- CONSTELLATION STORY ---")
    print("Cluster:", story_result["cluster_id"])
    print("Title:", story_result["title"])
    print("Story:", story_result["story"])
    print("Source:", story_result["source"])
    print("Statistics:", story_result["statistics"])