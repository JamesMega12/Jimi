// @ts-nocheck
import React from 'react';
import { Plus, Trash2, Copy, AlertTriangle } from 'lucide-react';
import { FcoDraft, FCORequestData } from '../types';

interface FcoTablesEditorProps {
  formData: FCORequestData;
  setFormData: React.Dispatch<React.SetStateAction<FCORequestData>>;
}

export function FcoTablesEditor({ formData, setFormData }: FcoTablesEditorProps) {
  // Ensure fcoTables exists
  React.useEffect(() => {
    if (formData.fcoDraft && !formData.fcoDraft.fcoTables) {
      setFormData(prev => {
        if (!prev.fcoDraft) return prev;
        return {
          ...prev,
          fcoDraft: {
            ...prev.fcoDraft,
            fcoTables: {
              fcoHistory: { status: 'active', rows: [] },
              partsOrKitsRequired: { status: 'active', rows: [] },
              specialEquipmentRequired: { status: 'active', rows: [] },
              partsRequiringRework: { status: 'active', rows: [] },
              partsToScrap: { status: 'active', rows: [] }
            }
          }
        };
      });
    }
  }, []);

  const d = formData.fcoDraft?.fcoTables;
  if (!d) return null;

  const updateTableConfig = (tableName: keyof typeof d, changes: any) => {
    setFormData(prev => {
      if (!prev.fcoDraft || !prev.fcoDraft.fcoTables) return prev;
      return {
        ...prev,
        fcoDraft: {
          ...prev.fcoDraft,
          fcoTables: {
            ...prev.fcoDraft.fcoTables,
            [tableName]: {
              ...prev.fcoDraft.fcoTables[tableName],
              ...changes
            }
          }
        }
      };
    });
  };

  const handleStatusChange = (tableName: keyof typeof d, event: React.ChangeEvent<HTMLInputElement>) => {
    updateTableConfig(tableName, { status: event.target.checked ? 'active' : 'not_applicable' });
  };

  const addRow = (tableName: keyof typeof d, defaultRow: any) => {
    const table = d[tableName];
    if (!table) return;
    const currentRows = table.rows || [];
    updateTableConfig(tableName, { rows: [...currentRows, defaultRow] });
  };

  const deleteRow = (tableName: keyof typeof d, rowIndex: number) => {
    const table = d[tableName];
    if (!table || !table.rows) return;
    updateTableConfig(tableName, { rows: table.rows.filter((_, i) => i !== rowIndex) });
  };

  const duplicateRow = (tableName: keyof typeof d, rowIndex: number) => {
    const table = d[tableName];
    if (!table || !table.rows) return;
    const newRow = { ...table.rows[rowIndex] };
    const newRows = [...table.rows];
    newRows.splice(rowIndex + 1, 0, newRow);
    updateTableConfig(tableName, { rows: newRows });
  };

  const updateRow = (tableName: keyof typeof d, rowIndex: number, field: string, value: string) => {
    const table = d[tableName];
    if (!table || !table.rows) return;
    const newRow = { ...table.rows[rowIndex], [field]: value };
    const newRows = [...table.rows];
    newRows[rowIndex] = newRow;
    updateTableConfig(tableName, { rows: newRows });
  };

  const clearTable = (tableName: keyof typeof d) => {
    updateTableConfig(tableName, { rows: [] });
  };

  const validateRow = (row: any, tableName: string) => {
    if (row.quantity && !row.partNumber && !row.partKitNumber && !row.description) {
        return "Row has quantity but no part number or description.";
    }
    const costValue = row.cost || row.reworkCost;
    if (costValue && !/^[0-9.,$A-Z ]*$/.test(costValue.toUpperCase())) {
         return "Cost format may need review."; // Very loose check
    }
    return null;
  };

  const renderTableCard = (
    title: string,
    tableName: keyof typeof d,
    columns: { header: string; field: string; width?: string; placeholder?: string }[],
    defaultRow: any
  ) => {
    const table = d[tableName];
    if (!table) return null; // Safe guard against incomplete state
    
    const isActive = table.status === 'active';
    const hasWarning = isActive && table.rows && table.rows.length === 0;

    return (
      <div className="bg-white border rounded-md shadow-sm overflow-hidden mb-4">
        <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
            <h4 className="font-semibold text-gray-900">{title}</h4>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-sm cursor-pointer">
                  <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={isActive}
                      onChange={(e) => handleStatusChange(tableName, e)}
                  />
                  <span>Active</span>
              </label>
            </div>
        </div>
        
        {isActive && (
            <div className="p-4 space-y-4">
            {hasWarning && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded flex items-start text-sm">
                    <AlertTriangle className="h-5 w-5 mr-2 shrink-0 mt-0.5" />
                    <div>
                    Table is empty. Add rows or mark as N/A.
                    </div>
                </div>
            )}
            
            {table.rows && table.rows.length > 0 && (
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                            <tr>
                                {columns.map(c => <th key={c.field} className={`px-3 py-2 font-medium ${c.width || ''}`}>{c.header}</th>)}
                                <th className="px-3 py-2 font-medium w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {table.rows.map((row, i) => {
                                const err = validateRow(row, tableName);
                                return (
                                <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50">
                                    {columns.map(c => (
                                        <td key={c.field} className="px-3 py-2 align-top">
                                            <input 
                                                type="text" 
                                                value={(row as any)[c.field] || ''} 
                                                onChange={(e) => updateRow(tableName, i, String(c.field), e.target.value)}
                                                className="w-full border-gray-300 rounded-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-1.5"
                                                placeholder={c.placeholder || ''}
                                            />
                                        </td>
                                    ))}
                                    <td className="px-3 py-2 align-top text-gray-400 flex items-center space-x-2 h-full py-3">
                                        <button type="button" onClick={() => duplicateRow(tableName, i)} title="Duplicate Row" className="hover:text-blue-600">
                                            <Copy className="h-4 w-4" />
                                        </button>
                                        <button type="button" onClick={() => deleteRow(tableName, i)} title="Delete Row" className="hover:text-red-600">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                        {err && (
                                            <div title={err} className="text-amber-500"><AlertTriangle className="h-4 w-4"/></div>
                                        )}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex space-x-3 pt-2">
                <button type="button" onClick={() => addRow(tableName, defaultRow)} className="flex items-center text-sm text-blue-600 font-medium hover:text-blue-700">
                    <Plus className="h-4 w-4 mr-1" /> Add Row
                </button>
                {table.rows && table.rows.length > 0 && (
                    <button type="button" onClick={() => clearTable(tableName)} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
                      Clear Table
                    </button>
                )}
            </div>
            </div>
        )}
        
        {!isActive && (
            <div className="p-4 py-6 text-center text-sm text-gray-500 bg-gray-50 border-t border-dashed">
               Table marked as Not Applicable (N/A)
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pt-4 border-t border-gray-200 mt-8">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 border-b pb-2">FCO Tables</h3>
        <p className="text-sm text-gray-500 mt-1">Configure structured table outputs. Leave "Active" checked or uncheck for N/A.</p>
      </div>

      <div className="space-y-4">
        {renderTableCard("FCO History", "fcoHistory", [
          { header: "FCO #", field: "fcoNumber", width: "w-32", placeholder: "e.g., FCO-XXXX" },
          { header: "Priority", field: "priority", width: "w-32" },
          { header: "Application", field: "application", width: "w-32" },
          { header: "Description", field: "description" }
        ], { fcoNumber: '', priority: '', application: '', description: '' })}

        {renderTableCard("Parts or Kits Required", "partsOrKitsRequired", [
          { header: "Qty.", field: "quantity", width: "w-20" },
          { header: "Part / Kit #", field: "partKitNumber", width: "w-32" },
          { header: "Description", field: "description" },
          { header: "Cost", field: "cost", width: "w-32" },
          { header: "Comments", field: "comments" }
        ], { quantity: '', partKitNumber: '', description: '', cost: '', comments: '' })}

        {renderTableCard("Special Equipment Required", "specialEquipmentRequired", [
          { header: "Qty.", field: "quantity", width: "w-20" },
          { header: "Part No.", field: "partNumber", width: "w-32" },
          { header: "Description", field: "description" },
          { header: "Cost", field: "cost", width: "w-32" },
          { header: "Comments", field: "comments" }
        ], { quantity: '', partNumber: '', description: '', cost: '', comments: '' })}

        {renderTableCard("Parts Requiring Rework", "partsRequiringRework", [
          { header: "Qty.", field: "quantity", width: "w-20" },
          { header: "Part No.", field: "partNumber", width: "w-32" },
          { header: "Description", field: "description" },
          { header: "Rework Cost", field: "reworkCost", width: "w-32" },
          { header: "Comments", field: "comments" }
        ], { quantity: '', partNumber: '', description: '', reworkCost: '', comments: '' })}

        {renderTableCard("Parts to Scrap", "partsToScrap", [
          { header: "Qty.", field: "quantity", width: "w-20" },
          { header: "Part No.", field: "partNumber", width: "w-32" },
          { header: "Description", field: "description" },
          { header: "Cost", field: "cost", width: "w-32" },
          { header: "Comments", field: "comments" }
        ], { quantity: '', partNumber: '', description: '', cost: '', comments: '' })}
      </div>
    </div>
  );
}
