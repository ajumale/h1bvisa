// Main JavaScript for U.S. Work Visa Database

document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    const searchForm = document.getElementById('searchForm');
    const visaTypeSelect = document.getElementById('visa_type');
    const yearSelect = document.getElementById('year');
    const quarterSelect = document.getElementById('quarter');
    const columnSelect = document.getElementById('column');
    const resultCount = document.getElementById('resultCount');
    const loadingResults = document.getElementById('loadingResults');
    const resultsContainer = document.getElementById('resultsContainer');
    const noResults = document.getElementById('noResults');
    const resultsHeader = document.getElementById('resultsHeader');
    const resultsBody = document.getElementById('resultsBody');
    const paginationContainer = document.getElementById('pagination');
    
    // Hide loading indicator initially
    loadingResults.style.display = 'none';
    const statsContainer = document.getElementById('statsContainer');
    
    // Important columns to display by visa type
    const displayColumnsByType = {
        'LCA': [
            'CASE_STATUS', 'EMPLOYER_NAME', 'JOB_TITLE', 'WAGE_RATE_OF_PAY_FROM',
            'WAGE_UNIT_OF_PAY', 'WORKSITE_CITY', 'WORKSITE_STATE'
        ],
        'H-2A': [
            'CASE_STATUS', 'EMPLOYER_NAME', 'JOB_TITLE', 'WAGE_OFFER',
            'PER', 'WORKSITE_CITY', 'WORKSITE_STATE'
        ],
        'H-2B': [
            'CASE_STATUS', 'EMPLOYER_NAME', 'JOB_TITLE', 'BASIC_WAGE_RATE_FROM',
            'PER', 'WORKSITE_CITY', 'WORKSITE_STATE'
        ]
    };
    
    // Current page and pagination state
    let currentPage = 1;
    let totalResults = 0;
    let resultsPerPage = 20;
    let currentSearchParams = {};
    
    // Cache for columns by visa type
    const columnsCache = {};
    
    // Initialize the app
    init();
    
    function init() {
        // Populate year dropdown based on selected visa type
        populateYearDropdown();
        
        // Fetch column names for the initial visa type
        fetchColumns(visaTypeSelect.value);
        
        // Add event listeners
        searchForm.addEventListener('submit', handleSearch);
        visaTypeSelect.addEventListener('change', handleVisaTypeChange);
        yearSelect.addEventListener('change', handleYearChange);
        quarterSelect.addEventListener('change', fetchStats);
        
        // Add event listeners for quick selectors in the Available Data accordion
        document.querySelectorAll('.visa-year-selector').forEach(selector => {
            selector.addEventListener('click', function() {
                const visaType = this.dataset.visaType;
                const year = this.dataset.year;
                
                // Update form selections
                visaTypeSelect.value = visaType;
                handleVisaTypeChange(); // Update year options
                
                // Then set the year
                yearSelect.value = year;
                handleYearChange(); // Update quarter options if needed
                
                // Scroll to the search form
                searchForm.scrollIntoView({ behavior: 'smooth' });
            });
        });
        
        // Load initial stats
        fetchStats();
    }
    
    function populateYearDropdown() {
        // Get the current visa type
        const visaType = visaTypeSelect.value;
        
        // Clear current options
        yearSelect.innerHTML = '<option value="">All Years</option>';
        
        // If we have data for this visa type
        if (availableData[visaType] && availableData[visaType].years) {
            // Sort years in descending order (newest first)
            const years = [...availableData[visaType].years].sort((a, b) => b - a);
            
            // Add years to dropdown
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = `FY${year}`;
                yearSelect.appendChild(option);
            });
        }
    }
    
    function handleVisaTypeChange() {
        // Update year dropdown with options for the selected visa type
        populateYearDropdown();
        
        // Reset quarter dropdown
        quarterSelect.value = '';
        
        // Fetch columns for the new visa type
        fetchColumns(visaTypeSelect.value);
        
        // Fetch updated stats
        fetchStats();
    }
    
    function handleYearChange() {
        // No additional logic needed for now, just fetch stats
        fetchStats();
    }
    
    function fetchColumns(visaType = 'LCA') {
        // Check cache first
        if (columnsCache[visaType]) {
            populateColumnDropdown(columnsCache[visaType]);
            return;
        }
        
        fetch(`/api/columns?visa_type=${visaType}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(columns => {
                // Cache the columns
                columnsCache[visaType] = columns;
                
                // Populate column dropdown
                populateColumnDropdown(columns);
            })
            .catch(error => console.error(`Error fetching columns for ${visaType}:`, error));
    }
    
    function populateColumnDropdown(columns) {
        // Populate column select dropdown
        columnSelect.innerHTML = '<option value="">All Fields</option>';
        columns.forEach(column => {
            const option = document.createElement('option');
            option.value = column;
            option.textContent = formatColumnName(column);
            columnSelect.appendChild(option);
        });
    }
    
    function fetchStats() {
        const visaType = visaTypeSelect.value;
        const year = yearSelect.value;
        const quarter = quarterSelect.value;
        
        statsContainer.innerHTML = `
            <div class="text-center">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading stats...</span>
                </div>
            </div>
        `;
        
        fetch(`/api/stats?visa_type=${visaType}&year=${year}&quarter=${quarter}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(stats => {
                if (stats.error) {
                    throw new Error(stats.error);
                }
                displayStats(stats);
            })
            .catch(error => {
                console.error('Error fetching stats:', error);
                statsContainer.innerHTML = `<div class="alert alert-danger">Error loading statistics: ${error.message || 'Unknown error'}</div>`;
            });
    }
    
    function displayStats(stats) {
        let html = '';
        
        // Display visa type and time period
        html += '<div class="stat-item">';
        html += `<div class="stat-label">Data Type</div>`;
        html += `<div class="stat-value">${visaTypes[stats.visa_type] || stats.visa_type}</div>`;
        html += '</div>';
        
        html += '<div class="stat-item">';
        html += `<div class="stat-label">Time Period</div>`;
        html += `<div class="stat-value">FY${stats.year}${stats.quarter !== 'All' ? ` Q${stats.quarter}` : ''}</div>`;
        html += '</div>';
        
        // Display case status breakdown
        if (stats.case_status) {
            html += '<div class="stat-item">';
            html += '<div class="stat-label">Case Statuses</div>';
            html += '<div class="stat-value">';
            
            for (const [status, count] of Object.entries(stats.case_status)) {
                html += `<div>${status}: ${count.toLocaleString()}</div>`;
            }
            
            html += '</div></div>';
        }
        
        // Display top employers
        if (stats.top_employers) {
            html += '<div class="stat-item">';
            html += '<div class="stat-label">Top 10 Employers</div>';
            html += '<div class="stat-value">';
            
            for (const [employer, count] of Object.entries(stats.top_employers)) {
                html += `<div class="top-employer"><span>${employer}</span> <span>${count.toLocaleString()}</span></div>`;
            }
            
            html += '</div></div>';
        }
        
        // Display average wage
        if (stats.avg_wage) {
            html += '<div class="stat-item">';
            html += '<div class="stat-label">Average Wage</div>';
            const unit = stats.wage_unit ? stats.wage_unit.toLowerCase() : 'year';
            html += `<div class="stat-value">$${stats.avg_wage.toLocaleString()}/${unit}</div>`;
            html += '</div>';
        }
        
        statsContainer.innerHTML = html || '<div class="alert alert-info">No statistics available</div>';
    }
    
    function handleSearch(e) {
        e.preventDefault();
        
        // Reset pagination
        currentPage = 1;
        
        // Show loading indicator
        loadingResults.style.display = 'block';
        resultsContainer.style.display = 'none';
        noResults.style.display = 'none';
        paginationContainer.style.display = 'none';
        
        // Get form values
        const formData = new FormData(searchForm);
        currentSearchParams = {
            query: formData.get('query'),
            visa_type: formData.get('visa_type'),
            year: formData.get('year'),
            quarter: formData.get('quarter'),
            column: formData.get('column'),
            page: currentPage,
            limit: resultsPerPage
        };
        
        // Execute search
        fetchResults(currentSearchParams);
    }
    
    function fetchResults(params) {
        // Build query string
        const queryString = Object.keys(params)
            .map(key => {
                // Only include parameters with values
                if (params[key]) {
                    return `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
                }
                return '';
            })
            .filter(param => param) // Remove empty params
            .join('&');
        
        // Show loading indicator
        loadingResults.style.display = 'block';
        resultsContainer.style.display = 'none';
        noResults.style.display = 'none';
        
        console.log(`Searching with: ${queryString}`);
            
        fetch(`/api/search?${queryString}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Search results:', data);
                if (data.error) {
                    throw new Error(data.error);
                }
                displayResults(data);
            })
            .catch(error => {
                console.error('Error fetching results:', error);
                loadingResults.style.display = 'none';
                noResults.style.display = 'block';
                noResults.innerHTML = `<div class="alert alert-danger">Error: ${error.message || 'Failed to fetch results'}</div>`;
            });
    }
    
    function displayResults(data) {
        console.log('Displaying results:', data);
        
        // Update result count
        totalResults = data.total;
        resultCount.textContent = `${totalResults.toLocaleString()} results`;
        
        // Hide loading indicator
        loadingResults.style.display = 'none';
        
        if (!data.results || data.results.length === 0) {
            // Show no results message
            noResults.style.display = 'block';
            resultsContainer.style.display = 'none';
            paginationContainer.style.display = 'none';
            return;
        }
        
        // Hide no results message and show results container
        noResults.style.display = 'none';
        resultsContainer.style.display = 'block';
        
        // Determine which visa type we're displaying
        const firstResult = data.results[0];
        const visaType = firstResult.VISA_TYPE || visaTypeSelect.value;
        
        // Get the preferred display columns for this visa type
        const preferredColumns = displayColumnsByType[visaType] || [];
        
        // Check which columns are actually available in the results
        const availableColumns = [];
        
        // First check if our preferred display columns exist in the data
        preferredColumns.forEach(column => {
            if (column in firstResult) {
                availableColumns.push(column);
            }
        });
        
        // If none of our display columns exist, use the first few columns from the data
        if (availableColumns.length === 0) {
            const resultKeys = Object.keys(firstResult)
                .filter(key => key !== 'VISA_TYPE'); // Exclude our added VISA_TYPE column
            
            // Add key columns first if they exist
            const keyColumns = ['CASE_NUMBER', 'CASE_STATUS', 'EMPLOYER_NAME', 'JOB_TITLE'];
            keyColumns.forEach(col => {
                if (resultKeys.includes(col) && !availableColumns.includes(col)) {
                    availableColumns.push(col);
                }
            });
            
            // Add more columns to reach at least 7 total
            const remainingColumns = resultKeys.filter(col => !availableColumns.includes(col));
            availableColumns.push(...remainingColumns.slice(0, 7 - availableColumns.length));
        }
        
        // Create table header
        let headerHTML = '';
        availableColumns.forEach(column => {
            headerHTML += `<th>${formatColumnName(column)}</th>`;
        });
        resultsHeader.innerHTML = headerHTML;
        
        // Create table body
        let bodyHTML = '';
        data.results.forEach(result => {
            bodyHTML += '<tr>';
            availableColumns.forEach(column => {
                let cellValue = result[column];
                // Format value for display
                if (cellValue === null || cellValue === undefined) {
                    cellValue = '';
                } else if ((column.includes('WAGE') || column === 'WAGE_OFFER' || column === 'BASIC_WAGE_RATE_FROM') && !isNaN(cellValue)) {
                    // Format wage values
                    cellValue = `$${parseFloat(cellValue).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                } else if (column.includes('DATE') && cellValue) {
                    // Format dates if they look like dates
                    if (/^\d{4}-\d{2}-\d{2}/.test(cellValue)) {
                        try {
                            const date = new Date(cellValue);
                            if (!isNaN(date.getTime())) {
                                cellValue = date.toLocaleDateString();
                            }
                        } catch (e) {
                            // Keep original value if date parsing fails
                        }
                    }
                }
                bodyHTML += `<td>${cellValue}</td>`;
            });
            bodyHTML += '</tr>';
        });
        resultsBody.innerHTML = bodyHTML;
        
        // Update pagination
        updatePagination(data.page, totalResults, data.limit);
    }
    
    function updatePagination(page, total, limit) {
        const pageCount = Math.ceil(total / limit);
        
        if (pageCount <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }
        
        paginationContainer.style.display = 'block';
        const paginationList = paginationContainer.querySelector('ul');
        let paginationHTML = '';
        
        // Previous page button
        paginationHTML += `
            <li class="page-item ${page === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${page - 1}" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
        `;
        
        // Determine page range to show
        let startPage = Math.max(1, page - 2);
        let endPage = Math.min(pageCount, page + 2);
        
        // Ensure we show at least 5 pages if possible
        if (endPage - startPage < 4) {
            if (startPage === 1) {
                endPage = Math.min(5, pageCount);
            } else if (endPage === pageCount) {
                startPage = Math.max(1, pageCount - 4);
            }
        }
        
        // First page
        if (startPage > 1) {
            paginationHTML += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="1">1</a>
                </li>
            `;
            if (startPage > 2) {
                paginationHTML += `
                    <li class="page-item disabled">
                        <a class="page-link" href="#">...</a>
                    </li>
                `;
            }
        }
        
        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item ${i === page ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        // Last page
        if (endPage < pageCount) {
            if (endPage < pageCount - 1) {
                paginationHTML += `
                    <li class="page-item disabled">
                        <a class="page-link" href="#">...</a>
                    </li>
                `;
            }
            paginationHTML += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${pageCount}">${pageCount}</a>
                </li>
            `;
        }
        
        // Next page button
        paginationHTML += `
            <li class="page-item ${page === pageCount ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${page + 1}" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;
        
        paginationList.innerHTML = paginationHTML;
        
        // Add click event listeners to pagination links
        const pageLinks = paginationList.querySelectorAll('.page-link');
        pageLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = parseInt(this.dataset.page, 10);
                if (!isNaN(page) && page > 0) {
                    handlePageChange(page);
                }
            });
        });
    }
    
    function handlePageChange(page) {
        // Update current page
        currentPage = page;
        
        // Show loading indicator
        loadingResults.style.display = 'block';
        resultsContainer.style.display = 'none';
        
        // Update search parameters with new page
        const params = { ...currentSearchParams, page };
        
        // Fetch results for new page
        fetchResults(params);
        
        // Scroll back to results
        document.querySelector('.card-header').scrollIntoView({ behavior: 'smooth' });
    }
    
    // Helper function to format column names for display
    function formatColumnName(column) {
        return column
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, l => l.toUpperCase());
    }
});
