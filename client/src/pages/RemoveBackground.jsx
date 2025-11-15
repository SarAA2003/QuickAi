import React, { useState } from 'react'
import { Eraser, Sparkles, FileText } from 'lucide-react'
import toast from 'react-hot-toast';
import axios from 'axios'
import { useAuth } from '@clerk/clerk-react';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const RemoveBackground = () => {
  const [input, setInput] = useState(null)
  const [preview, setPreview] = useState(null)
  const [processed, setProcessed] = useState(false)

  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')

  const {getToken} = useAuth()

  const onFileChange = (e) => {
    const file = e.target.files[0]
    setInput(file)
    if (file) {
      setPreview(URL.createObjectURL(file))
    }
  }

  const onSubmitHandler = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('image', input)
      const {data} = await axios.post('/api/ai/remove-image-background', formData, {
        headers: {Authorization:`Bearer ${await getToken()}`}
      })
      if (data.success) {
        setContent(data.content)
      } else {
        toast.error(data.message)
      }
    }
    catch (error) {
      toast.error(error.message)
    }
    setLoading(false)
  }

  return (
    <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>
      <form
        onSubmit={onSubmitHandler}
        className='w-full max-w-lg p-4 bg-white rounded-lg border border-gray-200'
      >
        <div className='flex items-center gap-3'>
          <Sparkles className='w-6 text-[#FF4938]' />
          <h1 className='text-xl font-semibold'>AI Image Background Remover</h1>
        </div>

        <p className='mt-6 text-sm font-medium'>Upload Image</p>
        <input
          type='file'
          accept='image/*'
          onChange={onFileChange}
          className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 text-gray-600 cursor-pointer'
          required
        />

        <p className='text-sm text-gray-500 font-light mt-2'>
          Supports JPG, PNG, and other image formats
        </p>

        <button disabled = {loading}
          type='submit'
          className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#F6AB41] to-[#FF4938] text-white px-4 py-2 mt-6 text-sm rounded-lg cursor-pointer'
        >
          {
            loading ? <span className='w-4 h-4 my-1 rounded-full border-2 border-t-transparent animate-spin'></span>
            :<Eraser className='w-5' />
          }
          Remove Background
        </button>
      </form>
      <div className='w-full max-w-lg p-4 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96'>
        <div className='flex items-center gap-3'>
          <FileText className='w-5 h-5 text-[#00DA83]' />
          <h1 className='text-xl font-semibold'>Analysis Result</h1>
        </div>
          {
            !content ? (
              <div className='flex-1 flex flex-col justify-center items-center text-sm text-gray-400'>
                <FileText className='w-9 h-9' />
                <p>Upload an image and click "Remove Background" to get started</p>
              </div>
            ) : (
              <img src={content} alt="image" className='mt-3 w-full h-full'/>
            )
          }

      </div>
    </div>
  )
}

export default RemoveBackground
