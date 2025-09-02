import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Paper,
  Box,
  Typography,
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Avatar,
  Skeleton,
  Alert,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
} from '@mui/icons-material';

/**
 * Standardized data table component with sorting, pagination, and actions
 */
const DataTable = ({
  // Data
  data = [],
  columns = [],
  loading = false,
  error = null,
  
  // Pagination
  page = 0,
  rowsPerPage = 10,
  totalCount = 0,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [5, 10, 25, 50],
  
  // Sorting
  orderBy = '',
  order = 'asc',
  onSort,
  
  // Selection
  selectable = false,
  selected = [],
  onSelectionChange,
  
  // Actions
  actions = [],
  onRowClick,
  
  // Styling
  stickyHeader = false,
  maxHeight = 'none',
  
  // Empty state
  emptyMessage = 'No data available',
  emptyIcon,
  
  // Row expansion
  expandable = false,
  renderExpandedRow,
  
  ...props
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [selectedRowForMenu, setSelectedRowForMenu] = React.useState(null);
  const [expandedRows, setExpandedRows] = React.useState(new Set());

  const handleMenuClick = (event, row) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedRowForMenu(row);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRowForMenu(null);
  };

  const handleActionClick = (action, row) => {
    handleMenuClose();
    action.onClick?.(row);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      onSelectionChange?.(data.map(row => row.id));
    } else {
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (event, id) => {
    event.stopPropagation();
    const selectedIndex = selected.indexOf(id);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = [...selected, id];
    } else {
      newSelected = selected.filter(selectedId => selectedId !== id);
    }

    onSelectionChange?.(newSelected);
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    const newOrder = isAsc ? 'desc' : 'asc';
    onSort?.(property, newOrder);
  };

  const handleExpandRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const isSelected = (id) => selected.indexOf(id) !== -1;
  const isExpanded = (id) => expandedRows.has(id);

  // Render cell content based on column type
  const renderCellContent = (row, column) => {
    const value = row[column.field];

    switch (column.type) {
      case 'avatar':
        return (
          <Avatar 
            src={value} 
            alt={row[column.altField] || ''}
            sx={{ width: 32, height: 32 }}
          >
            {!value && (row[column.altField] || '').charAt(0).toUpperCase()}
          </Avatar>
        );

      case 'chip':
        return (
          <Chip
            label={value}
            color={column.getColor?.(value) || 'default'}
            variant={column.variant || 'filled'}
            size="small"
          />
        );

      case 'boolean':
        return (
          <Chip
            label={value ? 'Yes' : 'No'}
            color={value ? 'success' : 'default'}
            variant="outlined"
            size="small"
          />
        );

      case 'date':
        return value ? new Date(value).toLocaleDateString() : '-';

      case 'datetime':
        return value ? new Date(value).toLocaleString() : '-';

      case 'currency':
        return value ? `$${Number(value).toFixed(2)}` : '-';

      case 'custom':
        return column.render?.(value, row) || value;

      default:
        return (
          <Box
            sx={{
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              maxWidth: '100%',
              lineHeight: 1.4
            }}
          >
            {value || '-'}
          </Box>
        );
    }
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box {...props}>
      <TableContainer
        component={Paper}
        sx={{ 
          maxHeight: maxHeight !== 'none' ? maxHeight : undefined,
          borderRadius: 2,
        }}
      >
        <Table stickyHeader={stickyHeader}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < data.length}
                    checked={data.length > 0 && selected.length === data.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
              )}
              
              {expandable && <TableCell />}
              
              {columns.map((column) => (
                <TableCell
                  key={column.field}
                  align={column.align || 'left'}
                  sx={{ 
                    minWidth: column.minWidth,
                    width: column.width,
                    fontWeight: 600,
                  }}
                  sortDirection={orderBy === column.field ? order : false}
                >
                  {column.sortable ? (
                    <TableSortLabel
                      active={orderBy === column.field}
                      direction={orderBy === column.field ? order : 'asc'}
                      onClick={() => handleSort(column.field)}
                    >
                      {column.headerName}
                    </TableSortLabel>
                  ) : (
                    column.headerName
                  )}
                </TableCell>
              ))}
              
              {actions.length > 0 && (
                <TableCell align="center" sx={{ width: 60 }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          
          <TableBody>
            {loading ? (
              // Loading skeleton
              Array.from(new Array(rowsPerPage)).map((_, index) => (
                <TableRow key={index}>
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Skeleton variant="rectangular" width={20} height={20} />
                    </TableCell>
                  )}
                  {expandable && (
                    <TableCell>
                      <Skeleton variant="rectangular" width={20} height={20} />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.field}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                  {actions.length > 0 && (
                    <TableCell>
                      <Skeleton variant="rectangular" width={24} height={24} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell 
                  colSpan={
                    columns.length + 
                    (selectable ? 1 : 0) + 
                    (expandable ? 1 : 0) + 
                    (actions.length > 0 ? 1 : 0)
                  }
                  align="center"
                  sx={{ py: 8 }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    {emptyIcon && (
                      <Box sx={{ color: 'text.secondary', fontSize: 48 }}>
                        {emptyIcon}
                      </Box>
                    )}
                    <Typography variant="body1" color="text.secondary">
                      {emptyMessage}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              // Data rows
              data.map((row) => {
                const isItemSelected = isSelected(row.id);
                const isItemExpanded = isExpanded(row.id);
                
                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      hover
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      selected={isItemSelected}
                      sx={{
                        cursor: onRowClick ? 'pointer' : 'default',
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      {selectable && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isItemSelected}
                            onChange={(event) => handleSelectRow(event, row.id)}
                          />
                        </TableCell>
                      )}
                      
                      {expandable && (
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExpandRow(row.id);
                            }}
                          >
                            {isItemExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                          </IconButton>
                        </TableCell>
                      )}
                      
                      {columns.map((column) => (
                        <TableCell
                          key={column.field}
                          align={column.align || 'left'}
                          sx={{ maxWidth: column.maxWidth }}
                        >
                          {column.tooltip ? (
                            <Tooltip title={column.tooltip(row[column.field], row)} arrow>
                              <Box>{renderCellContent(row, column)}</Box>
                            </Tooltip>
                          ) : (
                            renderCellContent(row, column)
                          )}
                        </TableCell>
                      ))}
                      
                      {actions.length > 0 && (
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(event) => handleMenuClick(event, row)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                    
                    {/* Expanded row content */}
                    {expandable && isItemExpanded && (
                      <TableRow>
                        <TableCell 
                          colSpan={
                            columns.length + 
                            (selectable ? 1 : 0) + 
                            1 + // expandable column
                            (actions.length > 0 ? 1 : 0)
                          }
                          sx={{ py: 0 }}
                        >
                          <Box sx={{ py: 2 }}>
                            {renderExpandedRow?.(row)}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalCount > 0 && (
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={onPageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={onRowsPerPageChange}
          rowsPerPageOptions={rowsPerPageOptions}
          sx={{
            borderTop: `1px solid ${theme.palette.divider}`,
            '& .MuiTablePagination-toolbar': {
              paddingLeft: 2,
              paddingRight: 2,
            },
          }}
        />
      )}

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {actions.map((action, index) => (
          <MenuItem
            key={index}
            onClick={() => handleActionClick(action, selectedRowForMenu)}
            disabled={action.disabled?.(selectedRowForMenu)}
          >
            <ListItemIcon>
              {action.icon}
            </ListItemIcon>
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default DataTable;
