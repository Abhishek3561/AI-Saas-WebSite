import {clerkClient} from "@clerk/express"

export const auth=async(req,res,next)=>{
    try {
        const {userId,has}=await req.auth()
        req.auth = { userId }
        const hasPremium=await has({plan:'premium_plan'})

        const user=await clerkClient.users.getUser(userId)

        if(!hasPremium && user.privateMetadata.free_usage){
            req.free_usage=user.privateMetadata.free_usage
        }
        else{
            await clerkClient.users.updateUserMetadata(userId,{
                privateMetadata:{
                    free_usage:0
                }
            })
            req.free_usage=0
        }
        req.plan=hasPremium ? 'premium_plan' :'free'
        next()

        
    } catch (error) {
        res.json({success:false,message: error.message})
    }
}