# Pagination & Year Filter Implementation Guide

## Status Summary

### ✅ COMPLETED:
1. **Pagination Component Created** - `frontend/src/components/ui/pagination.tsx`
   - Reusable pagination component with smart page number display
   - Shows "Showing X to Y of Z items"
   - Handles edge cases (first/last pages, middle pages)
   - Supports customizable item names

2. **Page Size Updated to 25** (from 20):
   - ✅ `frontend/src/pages/customers.tsx`
   - ✅ `frontend/src/pages/machines.tsx`
   - ✅ `frontend/src/pages/inventory.tsx`
   - ✅ `frontend/src/pages/repair-tickets.tsx`
   - ✅ `frontend/src/pages/work-orders.tsx`
   - ✅ `frontend/src/pages/warranty-repair-tickets.tsx`
   - ✅ `frontend/src/pages/warranty-work-orders.tsx`

3. **Pagination Added**:
   - ✅ `frontend/src/pages/pipeline-leads.tsx` - Full pagination with filter reset

4. **Pagination Partially Added**:
   - ⚠️ `frontend/src/pages/quote-management-enhanced.tsx` - State added, needs UI component placement

### 🔄 IN PROGRESS / TODO:
1. **Add Pagination** (need to add Pagination component to UI):
   - ⏳ `frontend/src/pages/quote-management-enhanced.tsx` - Find table end, add <Pagination /> component
   - ⏳ `frontend/src/pages/machine-rentals.tsx` - Full implementation needed

2. **Year Filtering** (NOT STARTED):
   - ⏳ `frontend/src/pages/repair-tickets.tsx`
   - ⏳ `frontend/src/pages/work-orders.tsx`
   - ⏳ `frontend/src/pages/warranty-repair-tickets.tsx`
   - ⏳ `frontend/src/pages/warranty-work-orders.tsx`
   - ⏳ `frontend/src/pages/pipeline-leads.tsx`
   - ⏳ `frontend/src/pages/quote-management-enhanced.tsx`

---

## Implementation Guide

### Part 1: Complete Pagination for Remaining Pages

#### For `quote-management-enhanced.tsx`:

**Step 1**: Already done - state and fetch function updated

**Step 2**: Find where the quotes table/list ends (search for where quotes are displayed)

**Step 3**: Add Pagination component after the table:
```tsx
{/* After the table/list closes */}
<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalCount={totalCount}
  pageSize={pageSize}
  onPageChange={setCurrentPage}
  itemName="quotes"
/>
```

**Step 4**: Add reset to page 1 when filters change:
```tsx
// In filter change handlers
setFilterStatus(value)
setCurrentPage(1) // Reset to first page
```

#### For `machine-rentals.tsx`:

**Full Implementation Needed:**

1. Add state:
```tsx
const [currentPage, setCurrentPage] = useState(1)
const [totalPages, setTotalPages] = useState(1)
const [totalCount, setTotalCount] = useState(0)
const [pageSize] = useState(25)
```

2. Update fetch function to include pagination:
```tsx
const response = await apiService.getMachineRentals({
  page: currentPage,
  limit: pageSize,
  // ... other filters
})

if (response.pagination) {
  setTotalPages(response.pagination.pages || 1)
  setTotalCount(response.pagination.total || 0)
}
```

3. Add useEffect for page changes:
```tsx
useEffect(() => {
  fetchRentals()
}, [currentPage])
```

4. Import and add Pagination component to UI

---

### Part 2: Year Filtering Implementation

#### Backend Support

**Check if backend supports year filtering:**

For repair tickets (`backend/routes/repairTickets.js`), the formatted_number has format `TK-01/25` where `25` is the year.

**Add year filter to backend route:**
```javascript
// In GET route
const year = req.query.year

if (year) {
  whereConditions.push(`rt.year_created = $${queryParams.length + 1}`)
  queryParams.push(year)
}
```

**Note**: Check if `year_created` column exists. If not, extract from `formatted_number`:
```javascript
if (year) {
  whereConditions.push(`EXTRACT(YEAR FROM rt.created_at) = $${queryParams.length + 1}`)
  queryParams.push(year)
}
```

#### Frontend Implementation

**For all ticket/order/quote pages, add:**

1. **Year Filter State:**
```tsx
const currentYear = new Date().getFullYear()
const [selectedYear, setSelectedYear] = useState(currentYear)
const [availableYears, setAvailableYears] = useState<number[]>([])
```

2. **Generate Available Years** (on mount):
```tsx
useEffect(() => {
  // Generate years from 2024 to current year + 1
  const startYear = 2024 // Your app start year
  const endYear = currentYear + 1
  const years = []
  for (let year = endYear; year >= startYear; year--) {
    years.push(year)
  }
  setAvailableYears(years)
}, [])
```

3. **Update Fetch to Include Year:**
```tsx
const fetchTickets = async () => {
  const response = await apiService.getRepairTickets({
    page: currentPage,
    limit: pageSize,
    year: selectedYear, // ADD THIS
    // ... other filters
  })
  // ...
}
```

4. **Add to useEffect Dependencies:**
```tsx
useEffect(() => {
  fetchTickets()
}, [currentPage, selectedYear]) // Added selectedYear
```

5. **Add Year Filter UI** (in the filters section):
```tsx
{/* Year Filter */}
<Select
  value={selectedYear.toString()}
  onValueChange={(value) => {
    setSelectedYear(parseInt(value))
    setCurrentPage(1) // Reset to first page
  }}
>
  <SelectTrigger className="w-[120px]">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {availableYears.map((year) => (
      <SelectItem key={year} value={year.toString()}>
        {year}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

### Specific Pages to Update

#### 1. `repair-tickets.tsx`

**Add Year Filter:**
- Location: After the existing filters (status, priority, etc.)
- Update query key: `['repair-tickets', searchTerm, filters, currentPage, selectedYear]`
- Update API call: `apiService.getRepairTickets({ ..., year: selectedYear })`

**Filter UI Location:** Around line 500-600 where other filters are displayed

#### 2. `work-orders.tsx`

Same implementation as repair-tickets.tsx

#### 3. `warranty-repair-tickets.tsx`

Same implementation as repair-tickets.tsx

#### 4. `warranty-work-orders.tsx`

Same implementation as work-orders.tsx

#### 5. `pipeline-leads.tsx`

**Add Year Filter:**
- Query key: `['leads', searchTerm, filters, currentPage, selectedYear]`
- API call: `apiService.getLeads({ ..., year: selectedYear })`
- UI: In the filter dropdown around line 770-800

#### 6. `quote-management-enhanced.tsx`

**Add Year Filter:**
- State already has filterStatus, add yearFilter
- Update fetchQuotes to include year
- Add year select in filters section

---

## Testing Checklist

### Pagination:
- [ ] Page size is 25 rows
- [ ] Page numbers display correctly (1, 2, 3, ...)
- [ ] "Previous" button disabled on page 1
- [ ] "Next" button disabled on last page
- [ ] Clicking page numbers changes data
- [ ] "Showing X to Y of Z items" displays correctly
- [ ] Filters reset to page 1
- [ ] Search resets to page 1

### Year Filtering:
- [ ] Current year (2025) is default
- [ ] Dropdown shows years from 2024 to 2026
- [ ] Selecting year filters tickets/orders correctly
- [ ] Only tickets with `/25` show when 2025 selected
- [ ] Only tickets with `/26` show when 2026 selected
- [ ] Year filter resets pagination to page 1
- [ ] Year filter persists when changing other filters

---

## Files Modified So Far

1. **Created:**
   - `frontend/src/components/ui/pagination.tsx`

2. **Modified:**
   - `frontend/src/pages/customers.tsx` - pageSize 20→25
   - `frontend/src/pages/machines.tsx` - pageSize 20→25
   - `frontend/src/pages/inventory.tsx` - pageSize 20→25
   - `frontend/src/pages/repair-tickets.tsx` - pageSize 20→25
   - `frontend/src/pages/work-orders.tsx` - pageSize 20→25
   - `frontend/src/pages/warranty-repair-tickets.tsx` - pageSize 20→25
   - `frontend/src/pages/warranty-work-orders.tsx` - pageSize 20→25
   - `frontend/src/pages/pipeline-leads.tsx` - Full pagination added
   - `frontend/src/pages/quote-management-enhanced.tsx` - Pagination state added (incomplete)

---

## Next Steps

1. ✅ Commit current pagination improvements
2. ⏳ Complete pagination for quote-management-enhanced and machine-rentals
3. ⏳ Implement year filtering for all ticket/order/quote pages
4. ⏳ Test thoroughly
5. ⏳ Deploy to server

---

## Estimated Time Remaining

- Complete pagination (2 pages): ~1 hour
- Implement year filtering (6 pages): ~2-3 hours
- Testing: ~1 hour
- **Total**: ~4-5 hours

---

## Backend Changes Needed

Check these backend routes to ensure they support year filtering:

1. `backend/routes/repairTickets.js` - Add year filter
2. `backend/routes/workOrders.js` - Add year filter
3. `backend/routes/warrantyRepairTickets.js` - Add year filter
4. `backend/routes/warrantyWorkOrders.js` - Add year filter
5. `backend/routes/leads.js` - Add year filter (check if needed)
6. `backend/routes/quotes.js` - Add year filter

**Sample Backend Implementation:**
```javascript
// In GET route query params
const year = req.query.year

// In where conditions
if (year) {
  // Option 1: If you have a year_created column
  whereConditions.push(`year_created = $${queryParams.length + 1}`)
  queryParams.push(year)
  
  // Option 2: Extract from timestamp
  // whereConditions.push(`EXTRACT(YEAR FROM created_at) = $${queryParams.length + 1}`)
  // queryParams.push(year)
  
  // Option 3: Extract from formatted_number (TK-01/25)
  // whereConditions.push(`RIGHT(formatted_number, 2) = $${queryParams.length + 1}`)
  // queryParams.push(year.toString().slice(-2)) // '2025' -> '25'
}
```


