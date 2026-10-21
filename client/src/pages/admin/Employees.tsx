import { getStoredUsers, updateUser, deleteUser } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Edit2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

export default function Employees() {
  const [users, setUsers] = useState(getStoredUsers());
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const { toast } = useToast();

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditDesignation(user.designation);
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    const updated = updateUser(editingUser.id, { name: editName, designation: editDesignation });
    setUsers(updated);
    setEditingUser(null);
    toast({
      title: "Success",
      description: "Employee updated successfully",
      className: "bg-green-500/10 border-green-500/20 text-white"
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      const updated = deleteUser(id);
      setUsers(updated);
      toast({
        title: "Success",
        description: "Employee deleted successfully",
        className: "bg-green-500/10 border-green-500/20 text-white"
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">Employees Directory</h2>
          <p className="text-slate-600">Manage employee details and roles</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-slate-200 text-slate-900 focus:border-primary/50"
          />
        </div>
      </div>

      {/* Mobile Employee Card List */}
      <div className="sm:hidden space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-slate-200 text-sm italic">
            No employees found.
          </div>
        ) : (
          filteredUsers.map((user) => (
            <Card key={`mobile-${user.id}`} className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{user.name}</h3>
                    <p className="font-mono text-primary text-xs font-semibold">{user.code}</p>
                  </div>
                  <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'} className={user.role === 'Admin' ? 'bg-primary/10 text-primary border-primary/20 text-xs' : 'bg-slate-100 text-slate-600 text-xs'}>
                    {user.role}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <span>{user.designation || 'Staff'}</span>
                  <div className="flex items-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                    <span className="text-[11px] font-medium text-slate-600">Active</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1 border-t border-slate-100">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-9 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 text-xs font-semibold"
                    onClick={() => handleEdit(user)}
                    data-testid={`button-edit-${user.id}`}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-9 bg-red-50 hover:bg-red-100 text-red-700 border-red-200 text-xs font-semibold"
                    onClick={() => handleDelete(user.id, user.name)}
                    data-testid={`button-delete-${user.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop/Tablet Table */}
      <Card className="hidden sm:block bg-white border-slate-200 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-slate-200">
                  <TableHead className="text-slate-500 font-bold whitespace-nowrap">Code</TableHead>
                  <TableHead className="text-slate-500 font-bold whitespace-nowrap">Name</TableHead>
                  <TableHead className="text-slate-500 font-bold whitespace-nowrap">Designation</TableHead>
                  <TableHead className="text-slate-500 font-bold whitespace-nowrap">Role</TableHead>
                  <TableHead className="text-slate-500 font-bold whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-slate-500 font-bold whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50 border-slate-100 transition-colors" data-testid={`row-employee-${user.id}`}>
                    <TableCell className="font-mono text-primary font-medium whitespace-nowrap">{user.code}</TableCell>
                    <TableCell className="font-bold text-slate-900 whitespace-nowrap">{user.name}</TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">{user.designation}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'} className={user.role === 'Admin' ? 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20' : 'bg-slate-100 text-slate-600'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                      <span className="text-xs text-slate-500 font-medium">Active</span>
                    </TableCell>
                    <TableCell className="flex gap-2 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100"
                        onClick={() => handleEdit(user)}
                        data-testid={`button-edit-${user.id}`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-red-50 hover:bg-red-100 text-red-600 border-red-100"
                        onClick={() => handleDelete(user.id, user.name)}
                        data-testid={`button-delete-${user.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Edit Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-white border-slate-200 text-slate-900"
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Designation</Label>
              <Input
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
                className="bg-white border-slate-200 text-slate-900"
                data-testid="input-edit-designation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingUser(null)}
              className="text-slate-600 border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-save-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
