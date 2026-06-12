export default function RecordingModel() {
    return (
        <div className=" bg-white p-8 font-sans">
            <div className="flex justify-center mb-4">
                <img src="/images/audio.svg" alt="Logo" className="h-16 w-16" />
            </div>
            {/* Header Section */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">21:23:48</h1>
                <div className="flex justify-center gap-4">
                    <button className="flex items-center bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-all">
                        <span className="mr-2">⏸</span>
                        Pause Recording
                    </button>
                    <button className="flex items-center bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg transition-all">
                        <span className="mr-2">⏹</span>
                        Stop Recording
                    </button>
                </div>
            </div>

        </div>
    )
}