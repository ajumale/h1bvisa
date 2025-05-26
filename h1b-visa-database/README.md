# H1B Visa LCA Database

A web-based search application for exploring Labor Condition Application (LCA) disclosures for H1B visa petitions filed with the U.S. Department of Labor (DOL) from 2020 to 2024.

## Features

- Search across all LCA disclosure data from 2020-2024
- Filter by specific years (2020, 2021, 2022, 2023, 2024)
- Search by specific fields or across all data
- View key statistics about the dataset
- Paginated results for better performance
- Responsive design for desktop and mobile devices

## Dataset Information

This application uses Labor Condition Application (LCA) disclosure data for H1B visa petitions. The data includes:

- Case information (status, dates, visa class)
- Employer details (name, location, industry)
- Job details (title, SOC code, wages)
- Worksite information (location)
- Legal representation details
- Prevailing wage information

## Requirements

- Python 3.6 or higher
- Flask
- Pandas

## Installation

1. Clone or download this repository
2. Make sure the CSV data files are in the correct location (parent directory)
3. Install the required dependencies:

```
python3 -m pip install flask pandas
```

## Running the Application

From the project directory, run:

```
python3 app.py
```

The application will be available at http://localhost:5000/

## Usage

1. Select a year range or specific year from the dropdown
2. Optionally select a specific field to search in
3. Enter your search terms in the search box
4. Click "Search" to view results
5. Use the pagination controls to navigate through results
6. View dataset statistics on the left sidebar

## Data Processing

The application processes CSV data files in chunks to handle large file sizes efficiently. Statistics are calculated using a sample of the data for performance reasons.

## License

This application is for educational and research purposes only. The underlying data is provided by the U.S. Department of Labor.
