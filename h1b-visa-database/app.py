import os
import pandas as pd
import numpy as np
import json as json_stdlib
from flask import Flask, render_template, request, jsonify

# Custom JSON encoder to handle NaN, infinite values, and other non-JSON serializable data
class CustomJSONEncoder(json_stdlib.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, float):
            if np.isnan(obj) or np.isinf(obj):
                return None
        return super().default(obj)

app = Flask(__name__)
# Configure Flask to use custom JSON encoder
app.json_encoder = CustomJSONEncoder

# Configuration
DATA_DIR = '/Users/ahmedismail/Desktop/archive'

# Helper function to get all available CSV files
def get_available_csv_files():
    all_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv')]
    return sorted(all_files)

# Group files by type and year
def group_data_files():
    all_files = get_available_csv_files()
    grouped_files = {
        'LCA': {},  # H-1B visa data
        'H-2A': {}, # Agricultural workers
        'H-2B': {}  # Non-agricultural temporary workers
    }
    
    for file in all_files:
        if file.startswith('LCA_Disclosure_Data_FY'):
            # Extract year and quarter
            parts = file.replace('LCA_Disclosure_Data_FY', '').replace('.csv', '').split('_Q')
            if len(parts) == 2:
                year, quarter = parts
                if year not in grouped_files['LCA']:
                    grouped_files['LCA'][year] = []
                grouped_files['LCA'][year].append({
                    'quarter': quarter,
                    'filename': file,
                    'full_path': os.path.join(DATA_DIR, file)
                })
        elif file.startswith('H-2A_Disclosure_Data_FY'):
            parts = file.replace('H-2A_Disclosure_Data_FY', '').replace('.csv', '').split('_Q')
            if len(parts) == 2:
                year, quarter = parts
                if year not in grouped_files['H-2A']:
                    grouped_files['H-2A'][year] = []
                grouped_files['H-2A'][year].append({
                    'quarter': quarter,
                    'filename': file,
                    'full_path': os.path.join(DATA_DIR, file)
                })
        elif file.startswith('H-2B_Disclosure') and 'FY' in file:
            # Handle different formats of H-2B files
            if 'FY' in file and '_Q' in file:
                # Extract year and quarter
                if 'Data_FY' in file:
                    parts = file.replace('H-2B_Disclosure_Data_FY', '').replace('.csv', '').split('_Q')
                else:
                    parts = file.replace('H-2B_Disclosure_FY', '').replace('.csv', '').split('_Q')
                    
                if len(parts) == 2:
                    year, quarter = parts
                    if year not in grouped_files['H-2B']:
                        grouped_files['H-2B'][year] = []
                    grouped_files['H-2B'][year].append({
                        'quarter': quarter,
                        'filename': file,
                        'full_path': os.path.join(DATA_DIR, file)
                    })
    
    return grouped_files

# Get all available files
CSV_FILES = get_available_csv_files()

# Group files by type and year for organized access
GROUPED_FILES = group_data_files()

# Cache for column names
COLUMNS = None

@app.route('/')
def index():
    # Get available years for each visa type
    visa_types = {
        'LCA': 'H-1B Visas',
        'H-2A': 'Agricultural Workers',
        'H-2B': 'Non-Agricultural Workers'
    }
    
    # Get available years and quarters for each visa type
    available_data = {}
    for visa_type, years in GROUPED_FILES.items():
        if years:  # Only include visa types with data
            available_data[visa_type] = {
                'label': visa_types.get(visa_type, visa_type),
                'years': sorted(years.keys())
            }
    
    return render_template('index.html', 
                          available_data=available_data,
                          visa_types=visa_types)

@app.route('/api/columns')
def get_columns():
    # Get visa type from request
    visa_type = request.args.get('visa_type', 'LCA')
    
    # Find the first available file for this visa type
    if visa_type in GROUPED_FILES and GROUPED_FILES[visa_type]:
        # Get first year
        first_year = sorted(GROUPED_FILES[visa_type].keys())[0]
        # Get first file in that year
        first_file = GROUPED_FILES[visa_type][first_year][0]['full_path']
        
        try:
            # Get the columns from this file
            df_sample = pd.read_csv(first_file, nrows=1)
            columns = df_sample.columns.tolist()
            return jsonify(columns)
        except Exception as e:
            print(f"Error reading columns from {first_file}: {e}")
            return jsonify([]), 500
    
    # If no files found for this visa type
    return jsonify([])

@app.route('/api/search', methods=['GET'])
def search():
    # Get search parameters
    query = request.args.get('query', '').lower().strip()
    visa_type = request.args.get('visa_type', 'LCA')
    year = request.args.get('year', '')
    quarter = request.args.get('quarter', '')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    offset = (page - 1) * limit
    column = request.args.get('column', '')
    
    # Print parameters for debugging
    print(f"Search params: visa_type='{visa_type}', year='{year}', quarter='{quarter}', query='{query}', page={page}, column='{column}'")
    
    # Find the appropriate files to search
    files_to_search = []
    
    if visa_type in GROUPED_FILES:
        if year and year in GROUPED_FILES[visa_type]:
            # If year is specified, use files for that year
            if quarter:
                # If quarter is specified, find the specific file
                for file_info in GROUPED_FILES[visa_type][year]:
                    if file_info['quarter'] == quarter:
                        files_to_search.append(file_info['full_path'])
                        break
            else:
                # If no quarter specified, use all files for that year
                files_to_search = [file_info['full_path'] for file_info in GROUPED_FILES[visa_type][year]]
        else:
            # If no year specified or year not found, search all files for the visa type
            for year_files in GROUPED_FILES[visa_type].values():
                files_to_search.extend([file_info['full_path'] for file_info in year_files])
    
    if not files_to_search:
        print(f"No files found for: visa_type={visa_type}, year={year}, quarter={quarter}")
        return jsonify({
            'total': 0,
            'page': page,
            'limit': limit,
            'results': [],
            'error': f"No data files found matching the specified criteria"
        })
    
    # Simplified approach: search across the files
    try:
        # Results and counts
        results = []
        total_count = 0
        files_processed = 0
        max_files = 3  # Limit files processed for performance
        
        # Process each file one at a time
        for file_path in files_to_search[:max_files]:
            print(f"Searching in file: {file_path}")
            
            # If no specific query, just return some rows from the first file
            if not query and not results:
                try:
                    df = pd.read_csv(file_path, nrows=limit, low_memory=False)
                    
                    # Clean data before conversion to records
                    df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
                    
                    # Convert numeric columns that might have problematic values
                    for col in df.select_dtypes(include=['float64', 'int64']).columns:
                        df[col] = df[col].astype(object).where(df[col].notna(), None)
                    
                    results = df.iloc[:limit].to_dict('records')
                    total_count = len(results)
                    
                    # If we have results, we can return them
                    if results:
                        break
                except Exception as e:
                    print(f"Error reading initial rows from {file_path}: {e}")
                    continue
            
            # For searching, use chunks to process large files
            if query:
                try:
                    chunk_size = 20000  # Smaller chunk size for faster processing
                    chunks_read = 0
                    max_chunks_per_file = 5  # Limit chunks processed per file
                    
                    # Process the file in chunks
                    for chunk in pd.read_csv(file_path, chunksize=chunk_size, low_memory=False):
                        chunks_read += 1
                        
                        # Filter the chunk based on search criteria
                        filtered = None
                        try:
                            if column and column in chunk.columns:
                                filtered = chunk[chunk[column].astype(str).str.contains(query, case=False, na=False)]
                            else:
                                # Create mask for matching rows
                                mask = pd.Series(False, index=chunk.index)
                                # Only search through string columns for efficiency
                                for col in chunk.select_dtypes(include=['object']).columns:
                                    try:
                                        mask |= chunk[col].astype(str).str.contains(query, case=False, na=False)
                                    except Exception as e:
                                        # Skip problematic columns
                                        print(f"Error searching column {col}: {e}")
                                filtered = chunk[mask]
                        except Exception as e:
                            print(f"Error filtering chunk: {e}")
                            continue
                        
                        if filtered is None or filtered.empty:
                            continue
                        
                        # Keep track of total matches
                        chunk_match_count = len(filtered)
                        total_count += chunk_match_count
                        
                        # If this chunk has rows we need for the current page
                        if total_count > offset:
                            # How many results we've found before this chunk
                            previous_results = total_count - chunk_match_count
                            
                            # Calculate start and end indices for this chunk
                            start_idx = max(0, offset - previous_results)
                            end_idx = min(chunk_match_count, (offset - previous_results) + (limit - len(results)))
                            
                            # Add rows to results if any are in our page range
                            if start_idx < chunk_match_count:
                                try:
                                    # Clean the filtered data before conversion to records
                                    filtered_clean = filtered.iloc[start_idx:end_idx].copy()
                                    filtered_clean = filtered_clean.replace({np.nan: None, np.inf: None, -np.inf: None})
                                    
                                    # Add the visa type as additional context
                                    filtered_clean['VISA_TYPE'] = visa_type
                                    
                                    # Convert numeric columns that might have problematic values
                                    for col in filtered_clean.select_dtypes(include=['float64', 'int64']).columns:
                                        filtered_clean[col] = filtered_clean[col].astype(object).where(filtered_clean[col].notna(), None)
                                    
                                    chunk_results = filtered_clean.to_dict('records')
                                    results.extend(chunk_results)
                                except Exception as e:
                                    print(f"Error processing results: {e}")
                            
                            # If we have enough results for this page
                            if len(results) >= limit:
                                break
                        
                        # Limit the number of chunks we process per file for performance
                        if chunks_read >= max_chunks_per_file:
                            break
                except Exception as e:
                    print(f"Error processing file {file_path}: {e}")
                    continue
                
                # Stop if we have enough results
                if len(results) >= limit:
                    break
            
            files_processed += 1
            
        return jsonify({
            'total': total_count,
            'page': page,
            'limit': limit,
            'results': results
        })
        
    except Exception as e:
        print(f"Error processing search: {e}")
        return jsonify({
            'total': 0,
            'page': page,
            'limit': limit,
            'results': [],
            'error': str(e)
        })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    visa_type = request.args.get('visa_type', 'LCA')
    year = request.args.get('year', '')
    quarter = request.args.get('quarter', '')
    
    # Find the appropriate files to analyze
    files_to_analyze = []
    
    if visa_type in GROUPED_FILES:
        if year and year in GROUPED_FILES[visa_type]:
            # If year is specified, use files for that year
            if quarter:
                # If quarter is specified, find the specific file
                for file_info in GROUPED_FILES[visa_type][year]:
                    if file_info['quarter'] == quarter:
                        files_to_analyze.append(file_info['full_path'])
                        break
            else:
                # If no quarter specified, use all files for that year
                files_to_analyze = [file_info['full_path'] for file_info in GROUPED_FILES[visa_type][year]]
        else:
            # If no year specified or year not found, use the most recent year
            recent_years = sorted(GROUPED_FILES[visa_type].keys(), reverse=True)
            if recent_years:
                recent_year = recent_years[0]
                files_to_analyze = [file_info['full_path'] for file_info in GROUPED_FILES[visa_type][recent_year]]
    
    if not files_to_analyze:
        return jsonify({
            'error': f"No data files found matching the specified criteria"
        })
    
    # Generate some basic statistics about the dataset
    stats = {
        'visa_type': visa_type,
        'year': year if year else 'All',
        'quarter': quarter if quarter else 'All'
    }
    
    # We'll analyze just the first file to keep it fast
    file_to_analyze = files_to_analyze[0]
    print(f"Generating stats from: {file_to_analyze}")
    
    try:
        # Read file in chunks
        chunk_size = 25000
        for i, chunk in enumerate(pd.read_csv(file_to_analyze, chunksize=chunk_size, low_memory=False)):
            # Only process the first few chunks to keep it fast
            if i > 2:  # Limit to first ~75k rows for stats
                break
                
            # Count case statuses
            if 'CASE_STATUS' in chunk.columns:
                status_counts = chunk['CASE_STATUS'].value_counts().to_dict()
                if 'case_status' not in stats:
                    stats['case_status'] = status_counts
                else:
                    for status, count in status_counts.items():
                        stats['case_status'][status] = stats['case_status'].get(status, 0) + count
            
            # Count top employers
            employer_col = next((col for col in ['EMPLOYER_NAME', 'TRADE_NAME_DBA'] if col in chunk.columns), None)
            if employer_col:
                employer_counts = chunk[employer_col].value_counts().head(10).to_dict()
                if 'top_employers' not in stats:
                    stats['top_employers'] = employer_counts
                else:
                    for employer, count in employer_counts.items():
                        if employer and isinstance(employer, str):
                            stats['top_employers'][employer] = stats['top_employers'].get(employer, 0) + count
                    # Keep only top 10
                    stats['top_employers'] = dict(sorted(stats['top_employers'].items(), 
                                                        key=lambda x: x[1], reverse=True)[:10])
            
            # Identify wage column based on visa type
            wage_col = None
            if visa_type == 'LCA':
                wage_col = 'WAGE_RATE_OF_PAY_FROM'
            elif visa_type == 'H-2A':
                wage_col = 'WAGE_OFFER'
            elif visa_type == 'H-2B':
                wage_col = 'BASIC_WAGE_RATE_FROM'
                
            # Average wage
            if wage_col and wage_col in chunk.columns:
                # Convert to numeric, ignoring errors
                wages = pd.to_numeric(chunk[wage_col], errors='coerce')
                # Filter out unreasonable values (e.g., wages under $5 or over $1M)
                wages = wages[(wages >= 5) & (wages <= 1000000)]
                
                if 'avg_wage' not in stats:
                    stats['avg_wage'] = wages.mean()
                    stats['wage_count'] = len(wages)
                    stats['wage_unit'] = 'Hour'
                    
                    # Try to determine wage unit
                    if 'WAGE_UNIT_OF_PAY' in chunk.columns and not chunk['WAGE_UNIT_OF_PAY'].empty:
                        units = chunk['WAGE_UNIT_OF_PAY'].value_counts()
                        if not units.empty:
                            stats['wage_unit'] = units.index[0]
                    elif 'PER' in chunk.columns and not chunk['PER'].empty:
                        units = chunk['PER'].value_counts()
                        if not units.empty:
                            stats['wage_unit'] = units.index[0]
                else:
                    total = stats['avg_wage'] * stats['wage_count'] + wages.sum()
                    stats['wage_count'] += len(wages)
                    stats['avg_wage'] = total / stats['wage_count'] if stats['wage_count'] > 0 else 0
        
        # Format the average wage
        if 'avg_wage' in stats:
            stats['avg_wage'] = round(stats['avg_wage'], 2) if not np.isnan(stats['avg_wage']) else 0
            del stats['wage_count']  # Remove the counter used for averaging
        
        return jsonify(stats)
        
    except Exception as e:
        print(f"Error generating stats: {e}")
        return jsonify({
            'error': f"Error generating statistics: {str(e)}",
            'visa_type': visa_type
        })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5004)
