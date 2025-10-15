import { useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function WarrantyWorkOrderDetailPage() {
  const { id } = useParams()

  return (
    <div className="p-4 space-y-4">
      <div className="card-mobile">
        <div className="flex items-center space-x-3 mb-4">
          <button className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Warranty Work Order Details</h1>
        </div>
        <p className="text-gray-600">Warranty work order details for ID: {id}</p>
      </div>
    </div>
  )
}
