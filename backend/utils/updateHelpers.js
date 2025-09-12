// Helper to validate at least one field exists
exports.requireAtLeastOneField = (body, allowedFields) => {
  const providedFields = Object.keys(body).filter(key => body[key] !== undefined);
  const isValid = providedFields.some(field => allowedFields.includes(field));
  
  return {
    isValid,
    error: isValid ? null : `At least one of these fields is required: ${allowedFields.join(', ')}`
  };
};

// Helper to build dynamic SQL for PATCH
exports.buildUpdateQuery = (body, allowedFields, tableName, id) => {
  const fields = [];
  const values = [];
  let idx = 1;

  allowedFields.forEach(field => {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${idx}`);
      values.push(body[field]);
      idx++;
    }
  });

  values.push(id); // Always add ID last
  const query = `UPDATE ${tableName} SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;

  return { query, values };
};