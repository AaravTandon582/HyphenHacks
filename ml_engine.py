import numpy as np
import pandas as pd
from scipy.spatial import Delaunay

# =========================================================
# 1. Z-SCORE NORMALIZATION
# =========================================================
def zscore_normalize_features(X):
    """
    Computes X_norm = (X - mu) / sigma
    """
    mu = np.mean(X, axis=0)
    sigma = np.std(X, axis=0)
    sigma[sigma == 0] = 1.0  # Prevent division by zero
    X_norm = (X - mu) / sigma
    return X_norm

# =========================================================
# 2. GRADIENT DESCENT
# =========================================================
def compute_gradient(X, y, w, b):
    m = X.shape[0]
    f_wb = np.dot(X, w) + b
    err = f_wb - y
    dj_dw = (1 / m) * np.dot(X.T, err)
    dj_db = (1 / m) * np.sum(err)
    return dj_dw, dj_db

def gradient_descent(X, y, w_in, b_in, alpha, num_iters):
    w = w_in
    b = b_in
    for i in range(num_iters):
        dj_dw, dj_db = compute_gradient(X, y, w, b)
        w = w - alpha * dj_dw
        b = b - alpha * dj_db
    return w, b

# =========================================================
# 3. K-MEANS CLUSTERING
# =========================================================
def find_closest_centroids(X, centroids):
    K = centroids.shape[0]
    idx = np.zeros(X.shape[0], dtype=int)  # Fixed: Initialized idx array
    
    for i in range(X.shape[0]):
        distances = np.linalg.norm(X[i] - centroids, axis=1)
        idx[i] = np.argmin(distances)
        
    return idx

def compute_centroids(X, idx, K):
    m, n = X.shape
    centroids = np.zeros((K, n))
    
    for k in range(K):
        points = X[idx == k]
        if len(points) > 0:
            centroids[k] = np.mean(points, axis=0)
            
    return centroids

def run_kmeans(X, initial_centroids, max_iters=10):
    K = initial_centroids.shape[0]
    centroids = initial_centroids
    
    for i in range(max_iters):
        idx = find_closest_centroids(X, centroids)
        centroids = compute_centroids(X, idx, K)
        
    return idx, centroids

# =========================================================
# 4. MAIN PIPELINE
# =========================================================
def process_data_into_constellations(df, n_clusters=4):
    numeric_df = df.select_dtypes(include=[np.number]).fillna(0)
    
    if numeric_df.shape[1] < 2:
        raise ValueError("Dataset needs at least 2 numerical columns.")

    X = numeric_df.values

    # 1. Normalize
    X_norm = zscore_normalize_features(X)

    # 2. Gradient Descent to project into 2D (X, Y) Coordinates
    m, n = X_norm.shape
    
    w_init_1 = np.zeros(n)
    w1, b1 = gradient_descent(X_norm, X_norm[:, 0], w_init_1, b_in=0, alpha=0.01, num_iters=100)
    
    w_init_2 = np.zeros(n)
    w2, b2 = gradient_descent(X_norm, X_norm[:, -1], w_init_2, b_in=0, alpha=0.01, num_iters=100)
    
    x_coords = np.dot(X_norm, w1) + b1
    y_coords = np.dot(X_norm, w2) + b2
    coords_2d = np.column_stack((x_coords, y_coords))

    # 3. K-Means Clustering
    np.random.seed(42)
    rand_indices = np.random.choice(coords_2d.shape[0], n_clusters, replace=False)
    initial_centroids = coords_2d[rand_indices]
    
    cluster_labels, _ = run_kmeans(coords_2d, initial_centroids, max_iters=10)

    processed_df = pd.DataFrame(coords_2d, columns=['X', 'Y'])
    processed_df['Cluster'] = cluster_labels

    return processed_df, numeric_df, cluster_labels

def generate_constellation_lines(cluster_coords):
    lines = []
    if len(cluster_coords) >= 4:
        tri = Delaunay(cluster_coords)
        for simplex in tri.simplices:
            for i in range(3):
                p1 = cluster_coords[simplex[i]]
                p2 = cluster_coords[simplex[(i+1)%3]]
                lines.append((p1[0], p2[0], p1[1], p2[1]))
    return lines

